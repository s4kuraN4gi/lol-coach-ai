import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
    const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://lolcoachai.com';
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: ['/dashboard/', '/api/', '/onboarding/', '/account/'],
        },
        sitemap: `${BASE}/sitemap.xml`,
    };
}
