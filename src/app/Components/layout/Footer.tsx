import Link from "next/link";

export default function Footer() {
    return (
        <footer className="w-full py-6 px-4 border-t border-slate-800/50 bg-slate-950/50 backdrop-blur-sm mt-auto">
            <div className="max-w-7xl mx-auto flex flex-col items-center gap-4 text-center">
                
                {/* Links (Optional, good for SEO/Trust) */}
                <div className="flex gap-6 text-sm text-slate-400">
                    <Link href="/terms" className="hover:text-primary-400 transition-colors">利用規約</Link>
                    <Link href="/privacy" className="hover:text-primary-400 transition-colors">プライバシーポリシー</Link>
                    <a href="https://forms.gle/example" target="_blank" rel="noopener noreferrer" className="hover:text-primary-400 transition-colors">お問い合わせ</a>
                </div>

                {/* Riot Games Disclaimer (Legal Jibber Jabber) */}
                <div className="max-w-3xl text-[10px] sm:text-xs text-slate-500 leading-relaxed">
                    <p>
                        LoL Coach AI isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
                    </p>
                </div>
                
                {/* Copyright */}
                <div className="text-[10px] text-slate-600">
                    &copy; {new Date().getFullYear()} LoL Coach AI. All rights reserved.
                </div>
            </div>
        </footer>
    );
}
