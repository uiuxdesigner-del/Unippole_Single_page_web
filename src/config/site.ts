export const siteConfig = {
  company: "ADINN Advertising Services",
  product: "UNIPOLE Advertising",
  tagline: "Visibility Built Above the Ordinary.",
  email: "hello@adinn.example",
  phone: "+91 90000 00000",
  whatsapp: "919000000000",
  address: "Madurai, Tamil Nadu, India",
  social: {
    instagram: "https://instagram.com/",
    linkedin: "https://linkedin.com/",
    facebook: "https://facebook.com/",
  },
  nav: [
    { label: "Home", href: "#top" },
    { label: "About UNIPOLE", href: "#about" },
    { label: "Why UNIPOLE", href: "#why" },
    { label: "Locations", href: "#locations" },
    { label: "Inventory", href: "#inventory" },
    { label: "Campaigns", href: "#campaigns" },
    { label: "FAQ", href: "#faq" },
    { label: "Contact", href: "#contact" },
  ],
};

export function buildWhatsAppUrl(message: string) {
  return `https://wa.me/${siteConfig.whatsapp}?text=${encodeURIComponent(message)}`;
}