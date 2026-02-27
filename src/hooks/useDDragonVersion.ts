import useSWR from "swr";
import { fetchLatestVersion } from "@/app/actions/riot";

const FALLBACK_VERSION = "14.24.1";

export function useDDragonVersion() {
    const { data } = useSWR("ddragon-version", fetchLatestVersion, {
        revalidateOnFocus: false,
        dedupingInterval: 3600000, // 1 hour
    });
    return data || FALLBACK_VERSION;
}
