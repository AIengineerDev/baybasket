import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'BayBasket | Compare groceries by city',description:'Compare grocery baskets in Tampa Bay, Silicon Valley and San Francisco. Real retailer photos, store-specific prices and clear coverage.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
