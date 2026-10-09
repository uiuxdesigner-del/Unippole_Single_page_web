export const siteConfig = {
  company: "ADINN Advertising Services",
  product: "UNIPOLE Advertising",
  tagline: "Visibility Built Above the Ordinary.",
  /** The single contact number used across the site. */
  phone: "+91 89298 84894",
  phoneHref: "tel:+918929884894",
  whatsapp: "918929884894",
  emails: [
    { label: "Operations Support", address: "signageoperationssupport_chn@adinn.co.in" },
    { label: "Business Development", address: "bde-signagechn@adinn.co.in" },
  ],
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