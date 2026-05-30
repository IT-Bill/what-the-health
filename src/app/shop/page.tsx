import Image from "next/image";

interface Product {
  id: string;
  name: string;
  description: string;
  price: string;
  image: string;
}

const products: Product[] = [
  {
    id: "watch",
    name: "Smart Watch",
    description: "Seamlessly track your vitals and daily movement with understated elegance.",
    price: "1,200 Cr",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBdYwvnSRAot7aGsVxuxexq-hFhV9RvfMXy-O6d6ZY9XzFtCQkraCJQCVPWN4l9gfEvzallUbyuw_eIOYQer6e3ybtqznDBA89bR61tJBwfJQx8tTVWQeaM2D6sURd02817gkV5YQY55VyfXxdCUbNwwo9VkgC9gg5FabcP0_cIhztiB5F3aPvIrEiexarwPhhUWzFoOVDHpziwmwHq64jHCzWThOrAA2U_0f5HCI0LAFim36YxwZNN8lSLF6zPbJr2VJ5lKhEBWK0",
  },
  {
    id: "oura",
    name: "Oura Ring",
    description: "Discreet sleep and recovery insights housed in a minimal titanium band.",
    price: "850 Cr",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDgToyXPhU2hCsNiMmFVuiDB1qlES2-PoZRMP7XzGC6vnqzIAl6-gVtkCH_4aXhn2PLFBhJ_k84844bhK3qDRZ3vQpPGWYJm5WKDvkXjNOqgYNf9jk8VRrymm5ejIh8IDOlmIVJ7TQpVAbnsnqqCAwEar4l4y9hQtDTGFGE2HA73bnbO503ajj51lCxbNBg140SzXYxxIXM086GVQQn1lUvgb6zkXwRz_YUjRQpf0dd1fsnjbO4ThMbP6vDFZtWai22jOLOreumz2g",
  },
  {
    id: "granola",
    name: "Organic Granola",
    description: "Small-batch roasted oats, nuts, and seeds sweetened with raw honey.",
    price: "50 Cr",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuCEvkFa4s98NX8lvz-rlJVw2DHal2RtsnQ1WKux5RWikXqfbdKkr8Bhf64PqjD12PX_3oxgN3VOW71ttymrNHTZJxCzDDnq5fFenl8wPmbhYpDRXmpxO3tt0BAZBLnPco5T9mFgzUjvmVlkdm-L3UGBL3LTivOBEaK4feNsuRdoLvH2oTKv7VFeplnK9F5Nqx5HFm-RXxJxtHl1dOa-o5B_Zm_D3kcg3YlZfS8fo53eBDC-5v6ZoOh9lZGpfKFwvsEVVxcQ3rvIWlA",
  },
  {
    id: "bread",
    name: "Artisan Bread",
    description: "Freshly baked, stone-ground whole wheat sourdough for a nourishing start.",
    price: "30 Cr",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuALM9Qp-7kffqXeIoIxamqU0r0QJ06p9p_Iz0WJKhM3Bw5adJ6Gpohm5vBDyffClNwpaWevXWWJ_nML_0T4BV6OyHpO_l-BLnugqjoDI46OsLCDYRAF-e8wLB3sLxj95H_s5JPX7pJJy_bhry7GeMp1kdAD_SooAXPojxsP7OUF51qdHOGeRhDNbEtZIWnYAFXaEx0CYLfdadUAlR11P-RpdKvaUTf8HMVbNun61eegu6yMCNPLIolv_BTc9ahDhAH-iEomfVfAjDY",
  },
  {
    id: "scale",
    name: "Smart Scale",
    description: "Comprehensive body composition metrics presented through a pristine glass surface.",
    price: "450 Cr",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDkpxmFZ3TQRjeUywB7GNOsXrvyMNspR7-oPUufnUb308pSOOYxRYYIpj-lCQ9GhznyxxqM1SgiOwXIfvPq0VfQcY0V66h1t3KwOhe-ezZiTPvNwGKM2wE_8SXcJ8bwzup_LS4U02604wucaWdg6vZFN9yo_5OsuM5itY5pRFetv2LGMZJM_TphKODBve-cfFZJEr8uayrFBUI2M-FGbhDYDf1Gp3yVHilB874pLbh0HxCyiFSmOFKNWsJHvNSYb8e8jAZTGGDq3Ww",
  },
  {
    id: "diffuser",
    name: "Stone Diffuser",
    description: "Scent your sanctuary with this handcrafted matte ceramic ultrasonic diffuser.",
    price: "120 Cr",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDXpEYMtYdtoHmouHGZKkNlsHjO8tdaysA5pSr8hQMjhVxfvlxhhLKoVcYoonB6TdaovJlYVpKu0mapHpzvdxPxdmR57aipfzugWTIXsU_axMGUQOhRxx0t3DChhZQEU2RU_DhW2wqRJQmsKmrhv9cugDxHlWCi2MA6WAsInmeOMgcWWmRA841rt947E21hLUckqK2GUWOqXJSnHVs5bohz6QIRkWDZu1KurGwzN9lLp2MHWRozg3Jh3FqNiu2ebYNIVb7VArkO9sQ",
  },
];

export default function ShopPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full px-6 md:px-16 py-4 flex items-center justify-between bg-surface/85 backdrop-blur-xl border-b border-surface-variant/50 transition-all duration-500">
        <button
          aria-label="Go back"
          className="w-10 h-10 flex items-center justify-start text-on-surface hover:opacity-70 transition-opacity"
        >
          <span className="material-symbols-outlined">arrow_back_ios_new</span>
        </button>
        <h1 className="font-[var(--font-display)] text-2xl font-medium text-center flex-1">
          Wellness Shop
        </h1>
        <div className="w-10 h-10 flex items-center justify-end text-primary">
          <span className="material-symbols-outlined">shopping_bag</span>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[1200px] mx-auto pb-20">
        {/* Credits Hero */}
        <section className="px-6 md:px-16 py-12 md:py-20 flex flex-col items-center justify-center text-center">
          <span className="text-sm font-medium text-outline uppercase tracking-widest mb-4">
            Available Balance
          </span>
          <div className="flex items-baseline gap-2">
            <span className="font-[var(--font-display)] text-5xl font-semibold text-on-surface">
              2,450
            </span>
            <span className="font-[var(--font-display)] text-2xl font-medium text-outline">
              Cr
            </span>
          </div>
          <p className="text-base text-on-surface-variant mt-4 max-w-md leading-relaxed">
            Redeem your mindful moments for curated tools designed to enhance
            your serenity and well-being.
          </p>
        </section>

        {/* Product Grid */}
        <section className="px-6 md:px-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function ProductCard({ product }: { product: Product }) {
  return (
    <article className="flex flex-col group cursor-pointer transition-all duration-500 hover:opacity-90">
      <div className="aspect-[4/5] w-full rounded-2xl overflow-hidden bg-surface-container-low mb-6 relative">
        <Image
          src={product.image}
          alt={product.name}
          fill
          className="object-cover transition-transform duration-1000 group-hover:scale-105"
        />
      </div>
      <div className="flex flex-col items-center text-center px-2">
        <h3 className="font-[var(--font-display)] text-2xl font-medium text-on-surface mb-2">
          {product.name}
        </h3>
        <p className="text-base text-on-surface-variant mb-4 line-clamp-2 leading-relaxed">
          {product.description}
        </p>
        <span className="text-sm font-medium text-primary bg-surface-variant/30 px-4 py-1.5 rounded-full">
          {product.price}
        </span>
      </div>
    </article>
  );
}
