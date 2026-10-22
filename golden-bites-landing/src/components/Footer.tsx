import { MessageCircle } from 'lucide-react';
import { InstagramIcon, FacebookIcon } from './SocialIcons';
import midasTechMark from '../assets/midas-tech.png';

const SOCIALS = [
  { icon: InstagramIcon, href: '#', label: 'Instagram' },
  { icon: FacebookIcon, href: '#', label: 'Facebook' },
  { icon: MessageCircle, href: '#', label: 'WhatsApp' },
];

export default function Footer() {
  return (
    <footer className="border-t border-black-border">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col items-center justify-between gap-8 md:flex-row md:items-start">
          <div className="flex flex-col items-center gap-3 md:items-start">
            <a href="#top" className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-gold/40 bg-gold/10 text-gold">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                  <path d="M4 17L5.2 8L9 12L12 6L15 12L18.8 8L20 17H4Z" />
                </svg>
              </span>
              <span className="font-display text-lg font-semibold text-bone">Golden Bites</span>
            </a>
            <p className="max-w-xs text-center text-sm text-bone-muted md:text-left">
              El antojo subió de categoría.
            </p>
          </div>

          <div className="flex gap-3">
            {SOCIALS.map((social) => {
              const Icon = social.icon;
              return (
                <a
                  key={social.label}
                  href={social.href}
                  aria-label={social.label}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-black-border text-bone-muted transition-colors hover:border-gold/50 hover:text-gold"
                >
                  <Icon size={17} />
                </a>
              );
            })}
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-black-border pt-6 text-xs text-bone-muted sm:flex-row">
          <p>© {new Date().getFullYear()} Golden Bites. Todos los derechos reservados.</p>
          <p>Bogotá, Colombia</p>
        </div>

        <div className="mt-6 flex flex-col items-center gap-1.5 text-center text-xs text-bone-muted">
          <img src={midasTechMark} alt="Midas Tech" className="h-7 w-auto" />
          <p>
            Desarrollado por Midas Tech
            <br />
            Donde las ideas se vuelven <span className="font-semibold text-gold">oro</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
