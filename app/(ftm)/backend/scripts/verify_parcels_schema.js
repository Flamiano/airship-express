/**
 * Verify that parcels table has booking_id column and fix if needed
 */
const { getServiceSupabase, getParcelsSupabase } = require('../config/db');

async function verifySchema() {
  const supabase = getParcelsSupabase() || getServiceSupabase();
  if (!supabase) {
    console.error('Database not configured');
    process.exit(1);
  }

  try {
    console.log('Checking parcels table schema...');
    
    // Get table info
    const { data, error } = await supabase
      .from('information_schema.columns')
      .select('*')
      .eq('table_name', 'parcels')
      .eq('table_schema', 'public');

    if (error) {
      console.error('Error querying schema:', error);
      // Try alternative approach - just try to select and see if booking_id exists
      console.log('Trying alternative approach: selecting parcels...');
      const { data: parcelSample, error: sampleError } = await supabase
        .from('parcels')
        .select('*')
        .limit(1);
      
      if (sampleError) {
        console.error('Error selecting parcels:', sampleError);
        process.exit(1);
      }

      if (parcelSample && parcelSample.length > 0) {
        const parcel = parcelSample[0];
        const hasBookingId = 'booking_id' in parcel;
        console.log('Parcel sample fields:', Object.keys(parcel));
        console.log('Has booking_id field:', hasBookingId);
        
        if (!hasBookingId) {
          console.log('⚠️  booking_id column is MISSING from parcels table!');
          console.log('Running migration to add booking_id column...');
          
          const { error: alterError } = await supabase.rpc('exec', {
            sql: `
              ALTER TABLE public.parcels
              ADD COLUMN IF NOT EXISTS booking_id text;
              CREATE INDEX IF NOT EXISTS idx_parcels_booking_id
              ON public.parcels(booking_id);
            `
          });
          
          if (alterError) {
            console.error('Error adding booking_id column:', alterError);
            // Try direct SQL approach
            console.log('Attempting direct SQL...');
          } else {
            console.log('✅ Successfully added booking_id column');
          }
        } else {
          console.log('✅ booking_id column exists');
        }
      }
      return;
    }

    const columns = data || [];
    const bookingIdColumn = columns.find(col => col.column_name === 'booking_id');
    
    if (!bookingIdColumn) {
      console.log('⚠️  booking_id column is MISSING from parcels table!');
      console.log('Available columns:', columns.map(c => c.column_name));
    } else {
      console.log('✅ booking_id column exists');
      console.log('   Type:', bookingIdColumn.data_type);
      console.log('   Nullable:', bookingIdColumn.is_nullable);
    }

  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

verifySchema();
