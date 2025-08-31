const bcrypt = require('bcrypt');

const hashPassword = async (pwd) => await bcrypt.hash(pwd, 10);

// Uso:
hashPassword('sebas123').then(console.log);
