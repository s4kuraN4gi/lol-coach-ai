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

// Step 1: Lookup Summoner (No DB, just Riot API)
export async function lookupSummoner(inputName: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

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

  // Check if already registered by anyone (or just this user? Usually unique constraint on puuid per user or globally?
  // Schema has unique(puuid)? No, user_id + puuid typically.
  // Previous code checked insert error 23505.
  // Let's check generally. If I want to allow multiple users to link same summoner (e.g. duo), I should check user_id.
  // But usually verification implies ownership which implies 1-to-1 or at least intentional.
  // Let's check for CURRENT USER for now.
  const { data: exists } = await supabase
    .from('summoner_accounts')
    .select('id')
    .eq('puuid', riotAccount.puuid)
    .single() // If global unique constraint exists, this checks global.
  
  if (exists) {
      // If global unique, message: "Already registered".
      return { error: 'このサモナーは既に登録されています' };
  }

  // Return necessary data for Step 2
  return {
      success: true,
      data: {
          gameName: riotAccount.gameName,
          tagLine: riotAccount.tagLine,
          puuid: riotAccount.puuid,
          summonerId: summonerDetail.id,
          accountId: summonerDetail.accountId,
          profileIconId: summonerDetail.profileIconId,
          summonerLevel: summonerDetail.summonerLevel
      }
  }
}

// Step 2: Verify Code and Add to DB
export async function verifyAndAddSummoner(summonerData: any, expectedCode: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    // 1. Verify Code
    const actualCode = await fetchThirdPartyCode(summonerData.summonerId);
    
    // Normalize codes (trim, handle null)
    if (!actualCode || actualCode.trim() !== expectedCode.trim()) {
        return { error: `認証に失敗しました。\n設定されたコード: ${actualCode || "(未設定)"}\n期待するコード: ${expectedCode}` };
    }

    // 2. Insert to DB
    const { data: newAccount, error: insertError } = await supabase
        .from('summoner_accounts')
        .insert({ 
        user_id: user.id,
        summoner_name: summonerData.gameName,
        tag_line: summonerData.tagLine,
        region: 'JP1', 
        puuid: summonerData.puuid,
        account_id: summonerData.accountId,
        summoner_id: summonerData.summonerId,
        profile_icon_id: summonerData.profileIconId,
        summoner_level: summonerData.summonerLevel
        })
        .select()
        .single()

    if (insertError) {
        console.error('Insert error:', insertError)
        return { error: 'DB保存に失敗しました' }
    }

    // 3. Set Active
    await supabase.from('profiles').update({ active_summoner_id: newAccount.id }).eq('id', user.id)

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
