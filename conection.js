const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fileUpload = require('express-fileupload');  // Para manejar la subida de archivos
const { MongoClient, GridFSBucket } = require('mongodb');
const fs = require('fs');

// Conectar a MongoDB
const mongoUrl = 'mongodb://localhost:27017';
const dbName = 'miBaseDeDatos';
let db, gfs, bucket;

MongoClient.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(client => {
    db = client.db(dbName);
    gfs = new GridFSBucket(db, { bucketName: 'uploads' });
    bucket = gfs;
    console.log("Conexión a MongoDB establecida.");
  })
  .catch(err => {
    console.error('Error al conectar a MongoDB:', err);
  });

const app = express();
const sqliteDb = new sqlite3.Database('./mydb.db');  // Base de datos SQLite para usuarios

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());  // Middleware para subir archivos

// Crear la tabla con padron como clave primaria (SQLite)
sqliteDb.run(`CREATE TABLE IF NOT EXISTS usuarios (
  padron TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  mail TEXT NOT NULL
);`, (err) => {
  if (err) {
    console.error('Error al crear la tabla:', err.message);
  } else {
    console.log('Tabla usuarios creada o ya existente.');
  }
});

app.use(express.static(path.join(__dirname, 'public')));

// Ruta para servir el archivo HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Insertar un nuevo usuario (SQLite)
app.post('/insert', (req, res) => {
  const { nombre, mail, padron } = req.body;

  const query = `INSERT INTO usuarios (padron, nombre, mail) VALUES (?, ?, ?)`;

  sqliteDb.run(query, [padron, nombre, mail], function (err) {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Error al insertar el usuario', error: err });
    }
    res.status(201).json({ message: 'Usuario agregado', data: { padron, nombre, mail } });
  });
});

// Obtener todos los usuarios (SQLite)
app.get('/usuarios', (req, res) => {
  const query = `SELECT * FROM usuarios`;

  sqliteDb.all(query, (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Error al obtener los usuarios', error: err });
    }
    res.status(200).json({ data: rows });
  });
});

// Actualizar un usuario por su padron (SQLite)
app.put('/update/:padron', (req, res) => {
  const { padron } = req.params;
  const { nombre, mail } = req.body;

  const query = `UPDATE usuarios SET nombre = ?, mail = ? WHERE padron = ?`;

  sqliteDb.run(query, [nombre, mail, padron], function (err) {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Error al actualizar el usuario', error: err });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    res.status(200).json({ message: 'Usuario actualizado' });
  });
});

app.delete('/delete/:padron', (req, res) => {
  const { padron } = req.params;

  const query = `DELETE FROM usuarios WHERE padron = ?`;

  sqliteDb.run(query, [padron], function (err) {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Error al eliminar el usuario', error: err });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    res.status(200).json({ message: 'Usuario eliminado' });
  });
});

//---------------------------MongoDB--------------------------------
app.post('/insertExamen', async (req, res) => {
  const { id_materia, examen, fecha } = req.body;

  try {
    const collection = db.collection('examenes');
    const result = await collection.insertOne({
      id_materia,
      examen, 
      fecha
    });

    res.status(201).json({ message: 'Examen agregado', data: { id_materia, examen, fecha } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al insertar el examen', error: err });
  }
});

app.get('/examenes', async (req, res) => {
  try {
    const collection = db.collection('examenes');
    const examenes = await collection.find({}).toArray();
    
    res.status(200).json({ data: examenes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al obtener los exámenes', error: err });
  }
});

app.post('/uploadExamenImage', (req, res) => {
  if (!req.files || !req.files.image) {
    return res.status(400).json({ message: 'No se ha subido ningún archivo.' });
  }

  const file = req.files.image;
  const uploadStream = bucket.openUploadStream(file.name);

  uploadStream.end(file.data);

  uploadStream.on('finish', async () => {
    const fileId = uploadStream.id; 

    const examen = {
      id_materia: req.body.id_materia,  
      examen: fileId,                   
      fecha: req.body.fecha            
    };

    try {
      const collection = db.collection('examenes');
      await collection.insertOne(examen);
      res.status(200).json({ message: 'Imagen subida correctamente', fileId });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Error al guardar el examen', error: err });
    }
  });

  uploadStream.on('error', (err) => {
    console.error(err);
    res.status(500).json({ message: 'Error al subir la imagen', error: err });
  });
});


// Servir la imagen desde MongoDB GridFS
app.get('/examenImage/:filename', (req, res) => {
  const filename = req.params.filename;

  const downloadStream = bucket.openDownloadStreamByName(filename);

  downloadStream.pipe(res);
  downloadStream.on('error', (err) => {
    console.error(err);
    res.status(404).json({ message: 'Imagen no encontrada' });
  });
});

app.delete('/deleteExamen/:id', async (req, res) => {
  const { id } = req.params; 

  try {
    const collection = db.collection('examenes');
    const examen = await collection.findOne({ _id: new MongoClient.ObjectID(id) });

    if (!examen) {
      return res.status(404).json({ message: 'Examen no encontrado' });
    }

    const fileId = examen.examen; 
    await bucket.delete(new MongoClient.ObjectID(fileId));

    await collection.deleteOne({ _id: new MongoClient.ObjectID(id) });

    res.status(200).json({ message: 'Examen eliminado correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al eliminar el examen', error: err });
  }
});

app.get('/buscarExamenes', async (req, res) => {
  const { id_materia, examen, fecha, page = 1, limit = 10 } = req.query;

  try {
    const collection = db.collection('examenes');

    // Construir filtros dinámicos
    let query = {};
    if (id_materia) {
      query.id_materia = id_materia;
    }
    if (examen) {
      query.examen = examen;
    }
    if (fecha) {
      // Suponiendo que `fecha` se pasa en formato ISO 8601 (e.g., "2024-12-06")
      query.fecha = new Date(fecha);
    }

    // Paginación y limitación
    const pageNumber = parseInt(page, 10);
    const pageSize = parseInt(limit, 10);

    const examenes = await collection.find(query)
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize)
      .toArray();

    res.status(200).json({ data: examenes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al buscar los exámenes', error: err });
  }
});





app.listen(3000, () => {
  console.log('Servidor corriendo en http://localhost:3000');
});
