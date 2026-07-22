const ContratosModel = require('../models/contratoModel');

const ContratosController = {
  // === CONTRATOS ===
  async getAll(req, res) {
    try {
      const contratos = await ContratosModel.getAllContratos();
      res.json(contratos);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async getContratoById(req, res) {
    const { id } = req.params;

    try {
      const contrato = await ContratosModel.getById(id);
      if (!contrato) {
        return res.status(404).json({ message: 'Contrato no encontrado' });
      }
      res.json(contrato);
    } catch (error) {
      console.error('Error en getContratoById controller:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  },

  async create(req, res) {
    try {
      const { cliente_id, monto_total } = req.body;
      if (!cliente_id || monto_total === undefined) {
        return res.status(400).json({ error: 'cliente_id y monto_total son requeridos' });
      }
      const contrato = await ContratosModel.createContrato(req.body);
      res.json(contrato);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async update(req, res) {
    try {
      const { cliente_id, monto_total, monto_restante, estado } = req.body;
      if (estado && !['creado', 'asignado', 'proceso', 'finalizado'].includes(estado)) {
        return res.status(400).json({ error: 'Estado invalido' });
      }
      const contrato = await ContratosModel.updateContrato(req.params.id, {
        cliente_id, monto_total, monto_restante, estado
      });
      res.json(contrato);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async remove(req, res) {
    try {
      const msg = await ContratosModel.deleteContrato(req.params.id);
      res.json(msg);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // === CONSUMOS_CONTRATO ===
  async getConsumos(req, res) {
    try {
      const consumos = await ContratosModel.getConsumosByContrato(req.params.contrato_id);
      res.json(consumos);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async createConsumo(req, res) {
    try {
      const { contrato_id, monto_consumido } = req.body;
      if (!contrato_id || monto_consumido === undefined) {
        return res.status(400).json({ error: 'contrato_id y monto_consumido son requeridos' });
      }
      const consumo = await ContratosModel.createConsumo(req.body);
      res.json(consumo);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async deleteConsumo(req, res) {
    try {
      const msg = await ContratosModel.deleteConsumo(req.params.id);
      res.json(msg);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // === DETALLES ===
  async getDetallesByConsumo(req, res) {
  try {
    const { consumo_id } = req.params;
    const detalles = await ContratosModel.getDetallesByConsumo(consumo_id);
    res.json(detalles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
},
async asignarConductor(req, res) {
  try {
    const { id } = req.params; // id del contrato
    const { conductor_id } = req.body;

    const contrato = await ContratosModel.asignarConductor(id, conductor_id);
    res.json({ exito: true, contrato });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
},

 async marcarEntregado(req, res) {
    const { consumoId } = req.params;
    try {
      const consumo = await ContratosModel.marcarEntregado(consumoId);
      if (!consumo) {
        return res.status(404).json({ message: 'Consumo no encontrado' });
      }
      res.json({ success: true, consumo });
    } catch (err) {
      console.error('Error en marcarEntregado:', err);
      res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
  },

async createDetalle(req, res) {
  try {
    const { consumo_id, producto_id, cantidad } = req.body;
    console.log(consumo_id,producto_id,cantidad);
    console.log("➡️ Recibido:", req.body);

    const resultado = await ContratosModel.createDetalles({
      consumo_id,
      producto_id,
      cantidad,
    });

    res.json({ exito: true, detalle: resultado });
  } catch (err) {
    console.error("❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
},

  async deleteDetalle(req, res) {
    try {
      const msg = await ContratosModel.deleteDetalle(req.params.id);
      res.json(msg);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};

module.exports = ContratosController;
