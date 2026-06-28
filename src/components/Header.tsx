"use client";

import { useEffect, useState } from "react";
import Logo from "./ui/Logo";
import Button from "./ui/Button";
import Container from "./ui/Container";
import { IconMenu, IconClose } from "./ui/icons";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "#services", label: "خدمات" },
  { href: "#pillars", label: "چهار رکن" },
  { href: "#process", label: "فرایند همکاری" },
  { href: "#about", label: "درباره‌ی ما" },
  { href: "/consultant", label: "گفت‌وگو با مشاور" },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // بستن منوی موبایل با کلید Escape و قفل اسکرول هنگام باز بودن
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-all duration-300",
        scrolled
          ? "bg-bone/90 shadow-soft backdrop-blur-md"
          : "bg-transparent"
      )}
    >
      <Container className="flex h-[4.5rem] items-center justify-between gap-4">
        {/* لوگو (راست در RTL) */}
        <a href="#hero" className="rounded-btn" aria-label="آرکان — خانه">
          <Logo />
        </a>

        {/* ناوبری دسکتاپ */}
        <nav aria-label="ناوبری اصلی" className="hidden lg:block">
          <ul className="flex items-center gap-8">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="rounded text-[0.95rem] text-ink/80 transition-colors hover:text-pine"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* CTA دسکتاپ (چپ در RTL) */}
        <div className="hidden lg:block">
          <Button as="a" href="#consultation" variant="primary" size="md">
            درخواست مشاوره
          </Button>
        </div>

        {/* دکمه‌ی منوی موبایل */}
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="flex h-11 w-11 items-center justify-center rounded-btn text-pine lg:hidden"
          aria-label={menuOpen ? "بستن منو" : "باز کردن منو"}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
        >
          {menuOpen ? <IconClose width={26} height={26} /> : <IconMenu width={26} height={26} />}
        </button>
      </Container>

      {/* منوی موبایل */}
      <div
        id="mobile-menu"
        className={cn(
          "overflow-hidden border-t border-sand bg-bone lg:hidden",
          menuOpen ? "max-h-[26rem]" : "max-h-0 border-t-0"
        )}
        style={{ transition: "max-height 0.3s ease" }}
      >
        <Container className="py-4">
          <nav aria-label="ناوبری موبایل">
            <ul className="flex flex-col">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className="block border-b border-sand/70 py-3.5 text-body text-ink/90"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <Button
            as="a"
            href="#consultation"
            variant="primary"
            size="lg"
            className="mt-4 w-full"
            onClick={() => setMenuOpen(false)}
          >
            درخواست مشاوره
          </Button>
        </Container>
      </div>
    </header>
  );
}
