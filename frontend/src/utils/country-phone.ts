export const countryDialOptions = [
  { name: '', dialCode: '' },
  { name: 'Qatar', dialCode: '+974' },
  { name: 'Saudi Arabia', dialCode: '+966' },
  { name: 'United Arab Emirates', dialCode: '+971' },
  { name: 'Bahrain', dialCode: '+973' },
  { name: 'Kuwait', dialCode: '+965' },
  { name: 'Oman', dialCode: '+968' },
  { name: 'India', dialCode: '+91' },
  { name: 'Pakistan', dialCode: '+92' },
  { name: 'Bangladesh', dialCode: '+880' },
  { name: 'Sri Lanka', dialCode: '+94' },
  { name: 'United Kingdom', dialCode: '+44' },
  { name: 'United States', dialCode: '+1' }
];

export function getDialCode(country: string) {
  return countryDialOptions.find((option) => option.name === country)?.dialCode || '';
}

export function applyCountryDialCode(phone: string, country: string) {
  const dialCode = getDialCode(country);
  if (!dialCode) return phone;

  const existingCode = countryDialOptions.find((option) => option.dialCode && phone.trim().startsWith(option.dialCode))?.dialCode;
  const localNumber = existingCode ? phone.trim().slice(existingCode.length).trim() : phone.trim();

  return localNumber ? `${dialCode} ${localNumber}` : `${dialCode} `;
}
