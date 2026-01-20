import { createClient } from '@supabase/supabase-js';

// Your Project URL
const supabaseUrl = 'https://olagmxkxsatktzelujfz.supabase.co';

// Your Anon Key (Safe for public use)
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sYWdteGt4c2F0a3R6ZWx1amZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MzQ5NzUsImV4cCI6MjA4NDQxMDk3NX0.0IEpZDBQggSuN81H2kqjYvrsN1X43UWiijLpD-SoQWk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);