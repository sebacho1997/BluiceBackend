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

  async getById(req, res) {
    try {
      const contrato = await ContratosModel.getContratoById(req.params.id);
      res.json(contrato);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async create(req, res) {
    try {
      const contrato = await ContratosModel.createContrato(req.body);
      res.json(contrato);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async update(req, res) {
    try {
      const contrato = await ContratosModel.updateContrato(req.params.id, req.body);
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
      const consumo = await ConsumoModel.marcarEntregado(consumoId);
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
