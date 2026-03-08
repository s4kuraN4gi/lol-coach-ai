'use server'

import { createClient, getUser } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { createHmac } from 'crypto'

import { fetchRiotAccount, fetchSummonerByPuuid } from './riot'
import { logger } from "@/lib/logger"
import { z } from "zod"

function signChallenge(puuid: string, targetIconId: number, expiresAt: number): string {
  const secret = process.env.VERIFICATION_SIGNING_SECRET;
  if (!secret) {
    throw new Error("VERIFICATION_UNAVAILABLE");
  }
  return createHmac('sha256', secret)
    .update(`${puuid}:${targetIconId}:${expiresAt}`)
    .digest('hex');
}

export type SummonerAccount = {
  id: string
  summoner_name: string
  tag_line: string | null
  region: string
  puuid: string | null
  account_id: string | null
  summoner_id: string | null
  profile_icon_id: number | null
  summoner_level: number | null
  created_at: string
}

// アクティブなサモナーを取得
export async function getActiveSummoner() {
    const supabase = await createClient()
    const user = await getUser()

    if(!user) return null;

    // プロフィールとそれに紐づくサモナー情報を一括取得 (JOIN)
    // active_summoner_id カラムを使って summoner_accounts を結合
    const { data: profile } = await supabase
        .from('profiles')
        .select(`
            active_summoner_id,
            active_summoner:summoner_accounts!active_summoner_id (*)
        `)
        .eq('id', user.id)
        .single()

    let activeAccount: SummonerAccount | null = null;

    if (profile?.active_summoner) {
        // JOINで取得できた場合 (型アサーションが必要な場合があるが、概ねany/objectで返る)
        // 配列か単体かはリレーション設定によるが、!active_summoner_idはN:1なので単体のはず、だが一応チェック
        // Supabase JSの型定義次第だが、ここはランタイムで確認
        const joined = profile.active_summoner as unknown; 
        // 配列なら先頭、オブジェクトならそのまま
        if(Array.isArray(joined)) {
             if(joined.length > 0) activeAccount = joined[0] as SummonerAccount;
        } else {
             activeAccount = joined as SummonerAccount;
        }
    }

    // フォールバック: アクティブが見つからない場合、最新のサモナーを自動設定
    if (!activeAccount) {
        const { data: latest } = await supabase
            .from('summoner_accounts')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (latest) {
            activeAccount = latest as SummonerAccount;
            // プロフィールを自動修復
            await supabase
                .from('profiles')
                .update({ active_summoner_id: latest.id })
                .eq('id', user.id)
        }
    }

    return activeAccount;
}

// ユーザーの全サモナーを取得
export async function getSummoners() {
    const supabase = await createClient()
    const user = await getUser()

    if(!user) return [];

    const { data } = await supabase
        .from('summoner_accounts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    return (data as SummonerAccount[]) ?? [];
}

const DEFAULT_ICONS = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28
];

// Step 1: Lookup Summoner & Generate Icon Challenge
export async function lookupSummoner(inputName: string) {
  const supabase = await createClient()
  const user = await getUser()
  if (!user) return { error: 'Not authenticated' }

  // 1. Check Security Status
  const { data: profile } = await supabase
    .from('profiles')
    .select('verification_failed_count, verification_locked_until')
    .eq('id', user.id)
    .single();
    
  // Lockout Check
  if (profile?.verification_locked_until) {
      const lockDate = new Date(profile.verification_locked_until);
      if (lockDate > new Date()) {
          return { error: 'VERIFICATION_LOCKED' as const, meta: { lockedUntil: lockDate.toLocaleString() } };
      } else {
          // Lock expired: Reset
          await supabase.from('profiles').update({ 
               verification_failed_count: 0,
               verification_locked_until: null 
          }).eq('id', user.id);
      }
  }

  const [gameName, tagLine] = inputName.split('#');
  if (!gameName || !tagLine) {
      return { error: 'FORMAT_ERROR' as const };
  }

  const riotAccount = await fetchRiotAccount(gameName, tagLine);
  if (!riotAccount) {
      return { error: 'SUMMONER_NOT_FOUND' as const };
  }

  const summonerDetail = await fetchSummonerByPuuid(riotAccount.puuid);
  if (!summonerDetail) {
      return { error: 'DETAIL_FETCH_FAILED' as const };
  }

  // Already Registered Check (Global)
  // We use an RPC function that runs as SECURITY DEFINER to bypass RLS
  const { data: isTaken, error: rpcError } = await supabase.rpc('check_summoner_taken', { target_puuid: riotAccount.puuid });
  
  if (rpcError) {
      logger.error('RPC Error:', rpcError);
      // Fallback: If RPC fails, we can't be sure, so maybe let it slide to the unique constraint check later?
      // Or block it. Let's block to be safe or treat as system error.
      // But for now, let's assume if it exists it returns true.
  }

  if (isTaken) {
      return { error: 'ALREADY_REGISTERED' as const };
  }

  // Generate Challenge (Random Icon)
  // Ensure we don't pick the current icon
  let targetIconId = DEFAULT_ICONS[Math.floor(Math.random() * DEFAULT_ICONS.length)];
  while(targetIconId === summonerDetail.profileIconId) {
      targetIconId = DEFAULT_ICONS[Math.floor(Math.random() * DEFAULT_ICONS.length)];
  }

  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
  const challenge = {
      targetIconId,
      puuid: riotAccount.puuid,
      expiresAt,
      sig: signChallenge(riotAccount.puuid, targetIconId, expiresAt),
  };

  const { error: updateError } = await supabase.from('profiles').update({
      verification_challenge: challenge
  }).eq('id', user.id);

  if (updateError) {
      logger.error('Profile update error:', updateError);
      return { error: 'DB_ERROR' as const };
  }

  return {
      success: true,
      data: {
          gameName: riotAccount.gameName,
          tagLine: riotAccount.tagLine,
          puuid: riotAccount.puuid,
          summonerId: summonerDetail.id,
          accountId: summonerDetail.accountId,
          profileIconId: summonerDetail.profileIconId,
          summonerLevel: summonerDetail.summonerLevel,
          targetIconId: targetIconId,
          expiresAt: challenge.expiresAt,
          failedCount: profile?.verification_failed_count || 0
      }
  }
}

const summonerDataSchema = z.object({
    gameName: z.string().min(1).max(32),
    tagLine: z.string().min(1).max(8),
    puuid: z.string().min(1).max(128),
    summonerId: z.string().optional(),
    accountId: z.string().optional(),
    profileIconId: z.number().int().nonnegative().optional(),
    summonerLevel: z.number().int().nonnegative().optional(),
    targetIconId: z.number().int().nonnegative().optional(),
    expiresAt: z.number().optional(),
    failedCount: z.number().int().nonnegative().optional(),
});

// Step 2: Verify Icon Change and Add to DB
// We don't need 'expectedCode' anymore, we check the DB challenge
export async function verifyAndAddSummoner(summonerData: unknown) {
    const parsed = summonerDataSchema.safeParse(summonerData);
    if (!parsed.success) {
        return { error: 'INVALID_INPUT' as const };
    }
    const validData = parsed.data;
    const supabase = await createClient()
    const user = await getUser()
    if (!user) return { error: 'Not authenticated' }

    // 1. Fetch Profile & Challenge
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
    
    if (!profile) return { error: "Profile not found" };

    // Check Lock
    if (profile.verification_locked_until && new Date(profile.verification_locked_until) > new Date()) {
        return { error: 'VERIFICATION_LOCKED' as const };
    }

    const challenge = profile.verification_challenge as any; // Type Assertion

    if (!challenge || !challenge.targetIconId) {
        return { error: 'INVALID_SESSION' as const };
    }

    // Verify HMAC signature (prevents direct DB manipulation of challenge)
    const expectedSig = signChallenge(challenge.puuid, challenge.targetIconId, challenge.expiresAt);
    if (!challenge.sig || challenge.sig !== expectedSig) {
        return { error: 'INVALID_SESSION' as const };
    }

    // Check Expiration
    if (Date.now() > challenge.expiresAt) {
        return { error: 'SESSION_EXPIRED' as const };
    }

    // Check consistency (Did they verify the same summoner?)
    if (challenge.puuid !== validData.puuid) {
        return { error: 'PUUID_MISMATCH' as const };
    }

    // Re-check summoner ownership (TOCTOU: another user may have registered between lookup and verify)
    const { data: isTaken } = await supabase.rpc('check_summoner_taken', { target_puuid: validData.puuid });
    if (isTaken) {
        return { error: 'ALREADY_REGISTERED' as const };
    }

    // 2. Fetch Current Riot Data
    // We need fresh data to check if icon changed (Disable Cache)
    const freshSummoner = await fetchSummonerByPuuid(validData.puuid, true);
    if (!freshSummoner) return { error: 'FETCH_FAILED' as const };

    // 3. Verify Icon ID
    if (freshSummoner.profileIconId !== challenge.targetIconId) {
        // --- FAILURE HANDLING ---
        const newCount = (profile.verification_failed_count || 0) + 1;
        const updates: Record<string, unknown> = { verification_failed_count: newCount };

        if (newCount >= 3) {
            // Lockout Logic: Lock until tomorrow 00:00
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);

            updates.verification_locked_until = tomorrow.toISOString();
            updates.verification_challenge = null;

            await supabase.from('profiles').update(updates).eq('id', user.id);
            return { error: 'LOCKED_TRIPLE_FAIL' as const };
        }

        await supabase.from('profiles').update(updates).eq('id', user.id);
        return { error: 'ICON_NOT_CHANGED' as const, meta: { current: freshSummoner.profileIconId, target: challenge.targetIconId, remaining: 3 - newCount } };
    }

    // --- SUCCESS ---
    // 4. Insert to DB
    const { data: newAccount, error: insertError } = await supabase
        .from('summoner_accounts')
        .insert({ 
        user_id: user.id,
        summoner_name: validData.gameName || freshSummoner.name, // Prefer Riot ID GameName
        tag_line: validData.tagLine, // Tagline might not be in v4 summoner, stick to input/account v1 data
        region: 'JP1', 
        puuid: freshSummoner.puuid,
        account_id: freshSummoner.accountId,
        summoner_id: freshSummoner.id,
        profile_icon_id: freshSummoner.profileIconId,
        summoner_level: freshSummoner.summonerLevel
        })
        .select()
        .single()

    if (insertError) {
        logger.error('Insert error:', insertError)
        // PostgreSQL Error 23505 = Unique Violation
        if (insertError.code === '23505') {
             return { error: 'ALREADY_REGISTERED' as const }
        }
        return { error: 'SYSTEM_ERROR' as const }
    }

    // 5. Cleanup & Set Active
    await supabase.from('profiles').update({ 
        active_summoner_id: newAccount.id,
        verification_challenge: null,
        verification_failed_count: 0
    }).eq('id', user.id)

    revalidatePath('/dashboard')
    revalidatePath('/account')
    
    return { success: true }
}

// サモナーを切り替える
export async function switchSummoner(summonerId: string) {
  const supabase = await createClient()
  const user = await getUser()
  if (!user) return { error: 'Not authenticated' }

  // IDが自分の所有するものか確認（RLSがあるが念のため）
  const { data: exists } = await supabase
    .from('summoner_accounts')
    .select('id')
    .eq('id', summonerId)
    .eq('user_id', user.id)
    .single()
  
  if (!exists) return { error: 'Invalid summoner ID' }

  const { error } = await supabase
    .from('profiles')
    .update({ active_summoner_id: summonerId })
    .eq('id', user.id)

  if (error) return { error: 'Failed to switch summoner' }

  revalidatePath('/dashboard')
  revalidatePath('/account')
  
  return { success: true }
}

// サモナーを削除
export async function removeSummoner(summonerId: string) {
  const supabase = await createClient()
  const user = await getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('summoner_accounts')
    .delete()
    .eq('id', summonerId)
    .eq('user_id', user.id)

  if (error) return { error: 'Failed to delete summoner' }

  revalidatePath('/dashboard')
  revalidatePath('/account')
  
  return { success: true }
}
// タイムアウト時の処理 (失敗カウント加算)
export async function registerVerificationTimeout() {
    const supabase = await createClient()
    const user = await getUser()
    if (!user) return { error: 'Not authenticated' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (!profile) return { error: "Profile not found" };

    const challenge = profile.verification_challenge as any;
    if (!challenge) return { success: true }; // Already cleared

    // 期限切れか確認 (クライアント・サーバー間の時計ズレを考慮し、1分の猶予を持たせる)
    // クライアントが「切れた」と言ってきた場合、サーバー時刻がまだでも1分以内なら許容する
    if (Date.now() < challenge.expiresAt - 60 * 1000) {
        return { error: 'NOT_EXPIRED_YET' as const };
    }
    
    // --- FAILURE HANDLING ---
    const newCount = (profile.verification_failed_count || 0) + 1;
    const updates: Record<string, string | number | null> = { verification_failed_count: newCount, verification_challenge: null }; // Clear challenge on timeout

    if (newCount >= 3) {
         const tomorrow = new Date();
         tomorrow.setDate(tomorrow.getDate() + 1);
         tomorrow.setHours(0, 0, 0, 0);

         updates.verification_locked_until = tomorrow.toISOString();

         await supabase.from('profiles').update(updates).eq('id', user.id);

         return { success: true, errorCode: 'TIMEOUT_LOCKED' as const };
    }

    await supabase.from('profiles').update(updates).eq('id', user.id);

    // revalidatePath calls removed to prevent client state reset (notification loss)

    return { success: true, errorCode: 'TIMEOUT' as const, meta: { remaining: 3 - newCount } };
}
