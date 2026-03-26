-- Supabase Database Schema Setup
-- Copy and paste this directly into the "SQL Editor" tab on your Supabase Dashboard

-- 1. Create the user_stories table to store our incoming test generations
CREATE TABLE IF NOT EXISTS user_stories (
  id uuid PRIMARY KEY,
  story TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  test_results JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Optional: Disable Row Level Security (RLS) entirely for testing purposes locally 
-- (This ensures your Python backend can read/write without auth tokens)
ALTER TABLE user_stories DISABLE ROW LEVEL SECURITY;
