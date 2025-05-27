const express = require('express');
const app = express();
const openTofuRoutes = require('./routes/opentofu');
const catalogRoutes = require('./routes/catalog');

app.use(express.json());
app.use('/api', openTofuRoutes);
app.use('/api', catalogRoutes);

require('dotenv').config();

const hostname = '0.0.0.0';
const port = process.env.PORT || 8000;
app.listen(port, hostname, () => {
    console.log(`✅ Serveur démarré sur http://${hostname}:${port}`);
});
