const fs = require('fs');

async function check() {
    const configStr = fs.readFileSync('supabase-config.js', 'utf8');
    const urlMatch = configStr.match(/const supabaseUrl = '([^']+)';/);
    const keyMatch = configStr.match(/const supabaseAnonKey = '([^']+)';/);

    if (!urlMatch || !keyMatch) {
        console.error("Could not find credentials");
        process.exit(1);
    }

    // Fallback if @supabase/supabase-js is not installed locally
    const url = `${urlMatch[1]}/rest/v1/sponsors?select=*`;
    const response = await fetch(url, {
        headers: {
            'apikey': keyMatch[1],
            'Authorization': `Bearer ${keyMatch[1]}`
        }
    });

    if (!response.ok) {
        const err = await response.text();
        console.error("Error fetching sponsors:", err);
    } else {
        const data = await response.json();
        console.log("Table exists! Row count:", data.length);
        console.log(JSON.stringify(data, null, 2));
    }
}

check();
