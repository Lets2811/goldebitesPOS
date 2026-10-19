import { parseLocationText, shortLinkIn } from './parse-location-link';

describe('parseLocationText', () => {
  it('reads an Android WhatsApp location', () => {
    expect(
      parseLocationText(
        'https://maps.google.com/maps?q=6.2442033%2C-75.5812119&z=17&hl=es',
      ),
    ).toEqual({ latitude: 6.2442033, longitude: -75.5812119, label: null });
  });

  it('reads an iPhone WhatsApp location, with the place name', () => {
    expect(
      parseLocationText(
        'https://maps.apple.com/?ll=6.208881,-75.567779&q=Parque%20Lleras',
      ),
    ).toEqual({
      latitude: 6.208881,
      longitude: -75.567779,
      label: 'Parque Lleras',
    });
  });

  it('reads the link inside a longer WhatsApp message', () => {
    const text =
      'Ubicación: https://maps.google.com/?q=6.25,-75.56 te espero en la portería';
    expect(parseLocationText(text)).toMatchObject({
      latitude: 6.25,
      longitude: -75.56,
    });
  });

  it('prefers the pin over the map viewport in a Google Maps place link', () => {
    const link =
      'https://www.google.com/maps/place/Parque+Berr%C3%ADo/@6.2500,-75.5700,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d6.2502541!4d-75.5682317';
    expect(parseLocationText(link)).toEqual({
      latitude: 6.2502541,
      longitude: -75.5682317,
      label: 'Parque Berrío',
    });
  });

  it('reads the viewport when there is no pin', () => {
    expect(
      parseLocationText('https://www.google.com/maps/@6.2442,-75.5812,15z'),
    ).toMatchObject({
      latitude: 6.2442,
      longitude: -75.5812,
    });
  });

  it('reads a Waze link', () => {
    expect(
      parseLocationText('https://waze.com/ul?ll=6.2442,-75.5812&navigate=yes'),
    ).toMatchObject({
      latitude: 6.2442,
      longitude: -75.5812,
    });
  });

  it('reads plain coordinates', () => {
    expect(parseLocationText('6.2442, -75.5812')).toEqual({
      latitude: 6.2442,
      longitude: -75.5812,
      label: null,
    });
  });

  it('does not take an address with numbers for coordinates', () => {
    expect(parseLocationText('Calle 10 # 43-20, apto 502')).toBeNull();
  });

  it('refuses coordinates out of range or at 0,0', () => {
    expect(parseLocationText('https://maps.google.com/?q=0,0')).toBeNull();
    expect(
      parseLocationText('https://maps.google.com/?q=95.1,-75.5'),
    ).toBeNull();
  });

  it('finds nothing in a short link (it has to be followed first)', () => {
    expect(parseLocationText('https://maps.app.goo.gl/AbCdEf123')).toBeNull();
    expect(
      shortLinkIn('mira https://maps.app.goo.gl/AbCdEf123')?.hostname,
    ).toBe('maps.app.goo.gl');
    expect(shortLinkIn('https://evil.example.com/x')).toBeNull();
  });
});
