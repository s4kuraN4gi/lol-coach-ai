type JsonLdProps = {
    data: Record<string, any>;
};

export default function JsonLd({ data }: JsonLdProps) {
    // Escape </ to prevent script tag injection in JSON-LD
    const safeJson = JSON.stringify(data).replace(/</g, '\\u003c');
    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: safeJson }}
        />
    );
}
