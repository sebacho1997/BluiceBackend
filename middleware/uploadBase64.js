const cloudinary = require('../config/cloudinary');
const { Readable } = require('stream');

function uploadBase64(req, res, next) {
  if (!req.body?.imagen_base64) return next();

  const match = req.body.imagen_base64.match(/^data:image\/(\w+);base64,(.+)$/);
  const base64Data = match ? match[2] : req.body.imagen_base64;
  const ext = match ? match[1] : 'jpg';

  const buffer = Buffer.from(base64Data, 'base64');

  cloudinary.uploader.upload_stream({ folder: 'productos', format: ext }, (err, result) => {
    if (err) return res.status(500).json({ mensaje: 'Error al subir imagen' });

    req.file = { path: result.secure_url, filename: result.public_id };
    delete req.body.imagen_base64;
    next();
  }).end(buffer);
}

module.exports = uploadBase64;
