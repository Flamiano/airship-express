'use client'; // Required for Next.js App Router

import { useEffect, useRef, useState } from 'react';

export default function CountrySearch() {
  const inputRef = useRef(null);
  const [country, setCountry] = useState('');

  useEffect(() => {
    function initAutocomplete() {
      if (!inputRef.current || !window.google?.maps?.places) return;

      const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
        types: ['(regions)'],
        fields: ['address_components'],
      });

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (!place || !place.address_components) return;

        place.address_components.forEach((component) => {
          if (component.types.includes('country')) {
            setCountry(`${component.long_name} (${component.short_name})`);
          }
        });
      });
    }

    // Avoid re-injecting the script if it's already on the page
    if (window.google?.maps?.places) {
      initAutocomplete();
      return;
    }

    const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!mapsKey) return;

    const existing = document.getElementById('google-places-script');
    if (existing) {
      existing.addEventListener('load', initAutocomplete);
      return () => existing.removeEventListener('load', initAutocomplete);
    }

    const script = document.createElement('script');
    script.id = 'google-places-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${mapsKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', initAutocomplete);
    script.addEventListener('error', () => {
      console.warn('Google Maps API is not enabled or the key is invalid. Country autocomplete disabled.');
    });
    document.head.appendChild(script);

    // No cleanup removal of the script tag — Google Maps isn't designed to be
    // torn down and reloaded, and removing it can leave `window.google` in a
    // half-broken state if this component mounts again elsewhere.
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
        Select Country:
      </label>
      <input
        ref={inputRef}
        type="text"
        placeholder="Type a country name..."
        style={{ padding: '10px', width: '100%', maxWidth: '300px', fontSize: '16px' }}
      />
      {country && (
        <p style={{ color: '#0070f3', marginTop: '10px', fontWeight: 'bold' }}>
          Selected: {country}
        </p>
      )}
    </div>
  );
}