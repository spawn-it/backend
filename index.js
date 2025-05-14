const express = require('express');
const app = express();
const openTofuRoutes = require('./routes/opentofu');

app.use(express.json());
app.use('/api', openTofuRoutes);

require('dotenv').config();

const hostname = '127.0.0.1';
const port = process.env.PORT || 8000;
app.listen(port, hostname, () => {
    console.log(`✅ Serveur démarré sur http://${hostname}:${port}`);
});
