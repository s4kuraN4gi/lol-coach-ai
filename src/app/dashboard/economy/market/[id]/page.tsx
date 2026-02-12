import { redirect } from "next/navigation";

export default async function AssetDetailRedirect({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    redirect(`/guide/gold/market/${id}`);
}
