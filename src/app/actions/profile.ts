'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

import { fetchRiotAccount, fetchSummonerByPuuid } from './riot'

export type SummonerAccount = {
  id: string
  summoner_name: string
  tag_line: string | null
  region: string
  profile_icon_id: number | null
  summoner_level: number | null
  created_at: string
}

// アクティブなサモナーを取得
export async function getActiveSummoner() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if(!user) return null;

    // プロフィールから active_summoner_id を取得
    const { data: profile } = await supabase
        .from('profiles')
        .select('active_summoner_id')
        .eq('id', user.id)
        .single()

    let activeAccount: SummonerAccount | null = null;

    if (profile?.active_summoner_id) {
        // active_summoner_id に紐づくサモナー情報を取得
        const { data: summoner } = await supabase
            .from('summoner_accounts')
            .select('*')
            .eq('id', profile.active_summoner_id)
            .single()
        
        if (summoner) {
            activeAccount = summoner as SummonerAccount;
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

// 新しいサモナーを追加して、自動的にアクティブにする
// input: "GameName#Tag" 形式
export async function addSummoner(inputName: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // 1. 入力解析 (Name#Tag)
  const [gameName, tagLine] = inputName.split('#');
  if (!gameName || !tagLine) {
      return { error: '正しい形式で入力してください (例: Hide on bush#KR1)' };
  }

  // 2. Riot APIでアカウント検索 (PUUID取得)
  const riotAccount = await fetchRiotAccount(gameName, tagLine);
  if (!riotAccount) {
      return { error: 'サモナーが見つかりませんでした (Riot IDを確認してください)' };
  }

  // 3. Summoner V4で詳細取得 (Icon, Level, SummonerID)
  const summonerDetail = await fetchSummonerByPuuid(riotAccount.puuid);
  if (!summonerDetail) {
      // 稀なケースだが、AccountはあるがSummonerが無い（Lv未プレイなど）
      return { error: 'サモナー情報の取得に失敗しました。LoLを未プレイの可能性があります。' };
  }

  // 4. DBに保存
  const { data: newAccount, error: insertError } = await supabase
    .from('summoner_accounts')
    .insert({ 
      user_id: user.id,
      summoner_name: riotAccount.gameName,   // 正しい大文字小文字で保存
      tag_line: riotAccount.tagLine,
      region: 'JP1', // 現在はJP固定だが、account.tsのREGION_ROUTINGに合わせるべき
      puuid: riotAccount.puuid,
      account_id: summonerDetail.accountId,
      summoner_id: summonerDetail.id,
      profile_icon_id: summonerDetail.profileIconId,
      summoner_level: summonerDetail.summonerLevel
    })
    .select()
    .single()

  if (insertError) {
    console.error('Add summoner error:', insertError)
    if(insertError.code === '23505') {
        return { error: 'このサモナーは既に登録されています。' }
    }
    return { error: 'サモナーの追加に失敗しました。DBエラー' }
  }

  // 5. プロフィールの active_summoner_id を更新
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ active_summoner_id: newAccount.id })
    .eq('id', user.id)

  if (updateError) {
      console.error('Update active error:', updateError)
      return { error: 'アクティブサモナーの設定に失敗しました。' }
  }

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
