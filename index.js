const express = require('express');
const cors = require('cors');
const app = express();
const openTofuRoutes = require('./routes/opentofu');
const catalogRoutes = require('./routes/catalog');
const templateRoutes = require('./routes/template');

app.use(cors({
    origin: 'http://localhost:3000'
}));

app.use(express.json());
app.use('/api', openTofuRoutes);
app.use('/api', catalogRoutes);
app.use('/api', templateRoutes);

require('dotenv').config();

const hostname = '0.0.0.0';
const port = process.env.PORT || 8000;
app.listen(port, hostname, () => {
    console.log(`✅ Serveur démarré sur http://${hostname}:${port}`);
});
