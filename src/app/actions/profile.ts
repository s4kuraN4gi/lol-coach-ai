'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

import { fetchRiotAccount, fetchSummonerByPuuid, fetchThirdPartyCode } from './riot'

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
    const { data: { user } } = await supabase.auth.getUser()
    
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
    const { data: { user } } = await supabase.auth.getUser()
    
    if(!user) return [];

    const { data } = await supabase
        .from('summoner_accounts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    return (data as SummonerAccount[]) ?? [];
}

const DEFAULT_ICONS = [
  29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, // More typical default icons
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11
];

// Step 1: Lookup Summoner & Generate Icon Challenge
export async function lookupSummoner(inputName: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
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
          return { error: `アカウント連携機能は制限されています。\n解除日時: ${lockDate.toLocaleString()}` };
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
      return { error: '正しい形式で入力してください (例: Hide on bush#KR1)' };
  }

  const riotAccount = await fetchRiotAccount(gameName, tagLine);
  if (!riotAccount) {
      return { error: 'サモナーが見つかりませんでした' };
  }

  const summonerDetail = await fetchSummonerByPuuid(riotAccount.puuid);
  if (!summonerDetail) {
      return { error: '詳細情報の取得に失敗しました' };
  }

  // Already Registered Check
  const { data: exists } = await supabase
    .from('summoner_accounts')
    .select('id')
    .eq('puuid', riotAccount.puuid)
    .single()
  
  if (exists) {
      return { error: 'このサモナーは既に登録されています' };
  }

  // Generate Challenge (Random Icon)
  // Ensure we don't pick the current icon
  let targetIconId = DEFAULT_ICONS[Math.floor(Math.random() * DEFAULT_ICONS.length)];
  while(targetIconId === summonerDetail.profileIconId) {
      targetIconId = DEFAULT_ICONS[Math.floor(Math.random() * DEFAULT_ICONS.length)];
  }

  const challenge = {
      targetIconId,
      puuid: riotAccount.puuid,
      expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
  };

  const { error: updateError } = await supabase.from('profiles').update({
      verification_challenge: challenge
  }).eq('id', user.id);

  if (updateError) {
      console.error('Profile update error:', updateError);
      return { error: '認証の準備に失敗しました。管理者に連絡してください (DB Error)' };
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
          expiresAt: challenge.expiresAt
      }
  }
}

// Step 2: Verify Icon Change and Add to DB
// We don't need 'expectedCode' anymore, we check the DB challenge
export async function verifyAndAddSummoner(summonerData: any) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
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
        return { error: "アカウント連携は一時的にロックされています。" };
    }

    const challenge = profile.verification_challenge as any; // Type Assertion

    if (!challenge || !challenge.targetIconId) {
        return { error: "認証セッションが無効です。最初からやり直してください。" };
    }

    // Check Expiration
    if (Date.now() > challenge.expiresAt) {
        return { error: "認証の有効期限(10分)が切れました。再試行してください。" };
    }

    // Check consistency (Did they verify the same summoner?)
    if (challenge.puuid !== summonerData.puuid) {
        return { error: "対象のサモナーが一致しません。" };
    }

    // 2. Fetch Current Riot Data
    // We need fresh data to check if icon changed (Disable Cache)
    const freshSummoner = await fetchSummonerByPuuid(summonerData.puuid, true);
    if (!freshSummoner) return { error: "サモナー情報の再取得に失敗しました。" };

    // 3. Verify Icon ID
    if (freshSummoner.profileIconId !== challenge.targetIconId) {
        // --- FAILURE HANDLING ---
        const newCount = (profile.verification_failed_count || 0) + 1;
        const updates: any = { verification_failed_count: newCount };

        let errorMsg = `アイコンが変更されていません。\n(現在: ${freshSummoner.profileIconId} / 指定: ${challenge.targetIconId})`;

        if (newCount >= 3) {
            // Lockout Logic: Lock until tomorrow 00:00 (or just +24h)
            // User requested "Next day reset". 
            // Simple: 24h from now, or midnight? Midnight is better for "Next day".
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);
            
            updates.verification_locked_until = tomorrow.toISOString();
            errorMsg = "認証に3回失敗したため、本日の認証機能をロックしました。\n明日またお試しください。";
            // Also clear challenge? Yes.
            updates.verification_challenge = null;
        } else {
            errorMsg += `\n残り試行回数: ${3 - newCount}回`;
        }

        await supabase.from('profiles').update(updates).eq('id', user.id);
        return { error: errorMsg };
    }

    // --- SUCCESS ---
    // 4. Insert to DB
    const { data: newAccount, error: insertError } = await supabase
        .from('summoner_accounts')
        .insert({ 
        user_id: user.id,
        summoner_name: summonerData.gameName || freshSummoner.name, // Prefer Riot ID GameName
        tag_line: summonerData.tagLine, // Tagline might not be in v4 summoner, stick to input/account v1 data
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
        console.error('Insert error:', insertError)
        return { error: `DB保存に失敗しました: ${insertError.message} (${insertError.details || ''})` }
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
  const { data: { user } } = await supabase.auth.getUser()
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
  const { data: { user } } = await supabase.auth.getUser()
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
