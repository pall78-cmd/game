import { createClient } from '@supabase/supabase-js';
const supabase = createClient('http://localhost:54321', 'A');
let ch1 = supabase.channel('chat');
console.log('ch1 state:', ch1.state);
supabase.removeChannel(ch1).then(() => {
    let ch2 = supabase.channel('chat');
    console.log('ch2 state:', ch2.state);
    console.log('ch1 === ch2:', ch1 === ch2);
});
