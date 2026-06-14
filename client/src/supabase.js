import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://prhbjxcfzucnryodqlaf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByaGJqeGNmenVjbnJ5b2RxbGFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0MzcwNjAsImV4cCI6MjA5NzAxMzA2MH0.e1n5ahD95O6yzoXN1tOQ6xinU0CtJOfDj_hGBpEC5Jw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
