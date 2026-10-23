const Notificacion = require('../models/Notificacion');

let ultimaLimpieza = 0;

const notificacionController = {
  async listar(req, res) {
    try {
      const afterId = Number.parseInt(req.query.afterId, 10);
      const { notificaciones, lastId } = await Notificacion.listar({
        afterId: Number.isFinite(afterId) && afterId > 0 ? afterId : 0,
      });

      if (Date.now() - ultimaLimpieza > 60 * 60 * 1000) {
        ultimaLimpieza = Date.now();
        Notificacion.limpiarAntiguas(30).catch((error) =>
          console.error('No se pudieron limpiar notificaciones antiguas:', error)
        );
      }

      res.json({ notificaciones, lastId });
    } catch (error) {
      console.error('Error al obtener notificaciones:', error);
      res.status(500).json({ error: 'No se pudieron obtener las notificaciones' });
    }
  },
};

module.exports = notificacionController;
