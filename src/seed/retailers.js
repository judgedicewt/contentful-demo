/**
 * Six fictional retailers. Addresses and phone numbers are placeholders;
 * coordinates are accurate to the city.
 */
const retailer = (id, { name, city, country, address, phone, lat, lon }) => ({
  id,
  contentType: 'retailer',
  fields: {
    name,
    city,
    country,
    address,
    phone,
    website: `https://example.com/retailers/${city.toLowerCase().replace(/\s+/g, '-')}`,
    location: { lat, lon },
  },
});

const entries = [
  retailer('retailer-london', {
    name: 'Strada Nova London',
    city: 'London',
    country: 'United Kingdom',
    address: '14 Hanover Mews\nMayfair\nLondon W1S 1AA',
    phone: '+44 20 0000 0101',
    lat: 51.5072,
    lon: -0.1276,
  }),
  retailer('retailer-manchester', {
    name: 'Strada Nova Manchester',
    city: 'Manchester',
    country: 'United Kingdom',
    address: '220 Deansgate\nManchester M3 4BG',
    phone: '+44 161 000 0102',
    lat: 53.4808,
    lon: -2.2426,
  }),
  retailer('retailer-munich', {
    name: 'Strada Nova München',
    city: 'Munich',
    country: 'Germany',
    address: 'Maximilianstrasse 31\n80539 München',
    phone: '+49 89 0000 0103',
    lat: 48.1351,
    lon: 11.582,
  }),
  retailer('retailer-miami', {
    name: 'Strada Nova Miami',
    city: 'Miami',
    country: 'United States',
    address: '3801 NE 2nd Avenue\nMiami, FL 33137',
    phone: '+1 305 555 0104',
    lat: 25.7617,
    lon: -80.1918,
  }),
  retailer('retailer-los-angeles', {
    name: 'Strada Nova Los Angeles',
    city: 'Los Angeles',
    country: 'United States',
    address: '8800 Sunset Boulevard\nWest Hollywood, CA 90069',
    phone: '+1 310 555 0105',
    lat: 34.0522,
    lon: -118.2437,
  }),
  retailer('retailer-dubai', {
    name: 'Strada Nova Dubai',
    city: 'Dubai',
    country: 'United Arab Emirates',
    address: 'Sheikh Zayed Road\nAl Quoz, Dubai',
    phone: '+971 4 000 0106',
    lat: 25.2048,
    lon: 55.2708,
  }),
];

export const RETAILERS_GROUP = { name: 'retailers', assets: [], entries };
