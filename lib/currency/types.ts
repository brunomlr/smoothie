export type CurrencyCode =
  // Primary currencies (keep at top)
  | 'USD' | 'EUR' | 'GBP' | 'BRL' | 'ARS' | 'CAD' | 'AUD'
  // Additional currencies (alphabetical)
  | 'AED' | 'AMD' | 'BAM' | 'BDT' | 'BHD' | 'BMD' | 'CHF' | 'CLP' | 'CNY' | 'COP'
  | 'CRC' | 'CZK' | 'DKK' | 'DOP' | 'GEL' | 'GTQ' | 'HKD' | 'HNL' | 'HUF' | 'IDR'
  | 'ILS' | 'INR' | 'JPY' | 'KES' | 'KRW' | 'KWD' | 'LBP' | 'LKR' | 'MMK' | 'MXN'
  | 'MYR' | 'NGN' | 'NOK' | 'NZD' | 'PEN' | 'PHP' | 'PKR' | 'PLN' | 'RON' | 'RUB'
  | 'SAR' | 'SEK' | 'SGD' | 'SVC' | 'THB' | 'TRY' | 'TWD' | 'UAH' | 'VEF' | 'VND'
  | 'XDR' | 'ZAR' | 'ZMW'

export interface Currency {
  code: CurrencyCode
  name: string
  symbol: string
  locale: string
}

export const SUPPORTED_CURRENCIES: Currency[] = [
  // Primary currencies (keep at top)
  { code: 'USD', name: 'US Dollar', symbol: '$', locale: 'en-US' },
  { code: 'EUR', name: 'Euro', symbol: '€', locale: 'de-DE' },
  { code: 'GBP', name: 'British Pound', symbol: '£', locale: 'en-GB' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', locale: 'pt-BR' },
  { code: 'ARS', name: 'Argentine Peso', symbol: '$', locale: 'es-AR' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$', locale: 'en-CA' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', locale: 'en-AU' },
  // Additional currencies (alphabetical)
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', locale: 'ar-AE' },
  { code: 'AMD', name: 'Armenian Dram', symbol: '֏', locale: 'hy-AM' },
  { code: 'BAM', name: 'Bosnia-Herzegovina Mark', symbol: 'KM', locale: 'bs-BA' },
  { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳', locale: 'bn-BD' },
  { code: 'BHD', name: 'Bahraini Dinar', symbol: '.د.ب', locale: 'ar-BH' },
  { code: 'BMD', name: 'Bermudian Dollar', symbol: '$', locale: 'en-BM' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', locale: 'de-CH' },
  { code: 'CLP', name: 'Chilean Peso', symbol: '$', locale: 'es-CL' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', locale: 'zh-CN' },
  { code: 'COP', name: 'Colombian Peso', symbol: '$', locale: 'es-CO' },
  { code: 'CRC', name: 'Costa Rican Colón', symbol: '₡', locale: 'es-CR' },
  { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč', locale: 'cs-CZ' },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr', locale: 'da-DK' },
  { code: 'DOP', name: 'Dominican Peso', symbol: 'RD$', locale: 'es-DO' },
  { code: 'GEL', name: 'Georgian Lari', symbol: '₾', locale: 'ka-GE' },
  { code: 'GTQ', name: 'Guatemalan Quetzal', symbol: 'Q', locale: 'es-GT' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', locale: 'zh-HK' },
  { code: 'HNL', name: 'Honduran Lempira', symbol: 'L', locale: 'es-HN' },
  { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft', locale: 'hu-HU' },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', locale: 'id-ID' },
  { code: 'ILS', name: 'Israeli Shekel', symbol: '₪', locale: 'he-IL' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', locale: 'en-IN' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', locale: 'ja-JP' },
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', locale: 'sw-KE' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩', locale: 'ko-KR' },
  { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'د.ك', locale: 'ar-KW' },
  { code: 'LBP', name: 'Lebanese Pound', symbol: 'ل.ل', locale: 'ar-LB' },
  { code: 'LKR', name: 'Sri Lankan Rupee', symbol: 'Rs', locale: 'si-LK' },
  { code: 'MMK', name: 'Myanmar Kyat', symbol: 'K', locale: 'my-MM' },
  { code: 'MXN', name: 'Mexican Peso', symbol: '$', locale: 'es-MX' },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', locale: 'ms-MY' },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', locale: 'en-NG' },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', locale: 'nb-NO' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', locale: 'en-NZ' },
  { code: 'PEN', name: 'Peruvian Sol', symbol: 'S/', locale: 'es-PE' },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱', locale: 'en-PH' },
  { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨', locale: 'ur-PK' },
  { code: 'PLN', name: 'Polish Złoty', symbol: 'zł', locale: 'pl-PL' },
  { code: 'RON', name: 'Romanian Leu', symbol: 'lei', locale: 'ro-RO' },
  { code: 'RUB', name: 'Russian Ruble', symbol: '₽', locale: 'ru-RU' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: 'ر.س', locale: 'ar-SA' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', locale: 'sv-SE' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', locale: 'en-SG' },
  { code: 'SVC', name: 'Salvadoran Colón', symbol: '₡', locale: 'es-SV' },
  { code: 'THB', name: 'Thai Baht', symbol: '฿', locale: 'th-TH' },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺', locale: 'tr-TR' },
  { code: 'TWD', name: 'Taiwan Dollar', symbol: 'NT$', locale: 'zh-TW' },
  { code: 'UAH', name: 'Ukrainian Hryvnia', symbol: '₴', locale: 'uk-UA' },
  { code: 'VEF', name: 'Venezuelan Bolívar', symbol: 'Bs', locale: 'es-VE' },
  { code: 'VND', name: 'Vietnamese Dong', symbol: '₫', locale: 'vi-VN' },
  { code: 'XDR', name: 'IMF Special Drawing Rights', symbol: 'SDR', locale: 'en-US' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', locale: 'en-ZA' },
  { code: 'ZMW', name: 'Zambian Kwacha', symbol: 'ZK', locale: 'en-ZM' },
]

export interface ExchangeRates {
  timestamp: number
  rates: Record<CurrencyCode, number>
}

export function getCurrencyByCode(code: CurrencyCode): Currency {
  return SUPPORTED_CURRENCIES.find(c => c.code === code) || SUPPORTED_CURRENCIES[0]
}
