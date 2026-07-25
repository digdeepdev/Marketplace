import { useEffect } from "react";

interface SeoOptions {
  title: string;
  description: string;
  canonicalUrl?: string;
  ogType?: string;
  /** Serializable JSON-LD object injected as a script tag while mounted. */
  jsonLd?: object;
}

function setMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(url: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", url);
}

/**
 * Lightweight head manager: sets document title, meta description,
 * OpenGraph/Twitter tags, canonical URL, and optional JSON-LD structured data.
 */
export function useSeo({ title, description, canonicalUrl, ogType = "website", jsonLd }: SeoOptions) {
  useEffect(() => {
    document.title = title;
    setMeta("name", "description", description);
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:type", ogType);
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);
    if (canonicalUrl) {
      setCanonical(canonicalUrl);
      setMeta("property", "og:url", canonicalUrl);
    }
  }, [title, description, canonicalUrl, ogType]);

  const jsonLdString = jsonLd ? JSON.stringify(jsonLd) : null;
  useEffect(() => {
    if (!jsonLdString) return;
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute("data-seo-jsonld", "true");
    script.textContent = jsonLdString;
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, [jsonLdString]);
}
