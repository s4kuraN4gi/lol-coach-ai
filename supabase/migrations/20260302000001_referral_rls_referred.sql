-- Allow referred users to check their own referral records (for trial extension check)
CREATE POLICY referrals_select_referred ON referrals
  FOR SELECT TO authenticated
  USING (referred_id = auth.uid());
