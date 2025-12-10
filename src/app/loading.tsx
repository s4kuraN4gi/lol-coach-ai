import LoadingAnimation from "./Components/LoadingAnimation";

export default function Loading() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-[#020617]">
            <LoadingAnimation />
        </div>
    );
}
