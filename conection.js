const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fileUpload = require('express-fileupload');  // Para manejar la subida de archivos
const { MongoClient, GridFSBucket, ObjectId } = require('mongodb');
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

// Eliminar un usuario por su padron (SQLite)
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

// ------------------- NUEVO CÓDIGO PARA EXÁMENES --------------------

// Insertar un nuevo examen (MongoDB)
app.post('/insertExamen', async (req, res) => {
  const { id_materia, examen, fecha } = req.body;

  try {
    // Insertar un nuevo examen en MongoDB
    const collection = db.collection('examenes');
    const result = await collection.insertOne({
      id_materia,
      examen,  // URL de la imagen o PDF almacenado en MongoDB GridFS
      fecha
    });

    res.status(201).json({ message: 'Examen agregado', data: { id_materia, examen, fecha } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al insertar el examen', error: err });
  }
});

// Obtener todos los exámenes (MongoDB)
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

// Subir una imagen de un examen (MongoDB GridFS)
app.post('/uploadExamenImage', async (req, res) => {
  if (!req.files || !req.files.image) {
    return res.status(400).json({ message: 'No se ha subido ningún archivo.' });
  }

  const { id_materia, fecha } = req.body;
  const file = req.files.image;
  const uploadStream = bucket.openUploadStream(file.name);

  // Escribe el archivo en MongoDB GridFS
  uploadStream.end(file.data);

  uploadStream.on('finish', async () => {
    const fileId = uploadStream.id;  // Guardamos el ID del archivo en GridFS
    console.log('Archivo subido con éxito:', fileId);

    const examen = {
      id_materia,
      examen: fileId,  // Guardamos el `fileId` en lugar del nombre del archivo
      fecha
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


// app.get('/examenImage/:filename', (req, res) => {
//   const filename = req.params.filename;

//   bucket.find({ filename }).toArray((err, files) => {
//     if (err || !files || files.length === 0) {
//       return res.status(404).json({ message: 'Archivo no encontrado' });
//     }

//     const downloadStream = bucket.openDownloadStreamByName(filename);
//     downloadStream.pipe(res);
//   });
// });

// Obtener una imagen de un examen de MongoDB GridFS por su ObjectId
app.get('/examenImage/:id', async (req, res) => {
  const fileId = req.params.id;  // ID recibido en la URL

  try {
    // Convertir el fileId a ObjectId
    const { ObjectId } = require('mongodb');
    const objectId = new ObjectId(fileId);
    
    // Intentamos encontrar el archivo en GridFS
    const file = await bucket.find({ _id: objectId }).next();  // Usamos await con next()
    
    if (!file) {
      console.error("Archivo no encontrado en GridFS para el ID:", fileId);
      return res.status(404).json({ message: 'Archivo no encontrado' });
    }

    // Configuramos los encabezados para indicar que es una descarga de archivo
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${file.filename}"`,
    });

    // Abrimos el stream de descarga del archivo usando el bucket
    const downloadStream = bucket.openDownloadStream(objectId);

    // Enviar los datos del archivo al cliente
    downloadStream.pipe(res);

    // Manejar errores en el flujo de datos
    downloadStream.on('error', (err) => {
      console.error("Error en el stream de descarga:", err);
      res.status(500).json({ message: 'Error al descargar el archivo', error: err });
    });

    downloadStream.on('end', () => {
      res.end(); // Finalizar la respuesta correctamente
    });

  } catch (err) {
    console.error("Error al procesar la solicitud:", err);
    res.status(500).json({ message: 'Error al procesar la solicitud', error: err });
  }
});

// Obtener un examen específico por ID
app.get('/examenes/:id', async (req, res) => {
  const examenId = req.params.id;  // Obtiene el ID del examen de la URL
  try {
    const examen = await db.collection('examenes').findOne({ _id: new ObjectId(examenId) });
    if (!examen) {
      return res.status(404).json({ message: 'Examen no encontrado' });
    }
    res.status(200).json({ data: examen });
  } catch (error) {
    console.error('Error al obtener el examen:', error);
    res.status(500).json({ message: 'Error al obtener el examen', error: error });
  }
});

// Eliminar un examen de MongoDB y GridFS
app.delete('/deleteExamen/:id', async (req, res) => {
  const { id } = req.params;  // 'id' es el ID del examen en la colección de MongoDB
  console.log("Recibiendo solicitud para eliminar el examen con ID:", id);

  try {
    // Buscar el examen en la colección 'examenes' para obtener el ID del archivo en GridFS
    const collection = db.collection('examenes');
    const examen = await collection.findOne({ _id: new ObjectId(id) });  // Usa ObjectId desde 'mongodb'

    if (!examen) {
      console.error("Examen no encontrado para el ID:", id);
      return res.status(404).json({ message: 'Examen no encontrado' });
    }

    console.log("Examen encontrado:", examen);

    // Eliminar el archivo del GridFS usando el fileId (almacenado en el campo 'examen')
    const fileId = examen.examen;  // El campo 'examen' tiene el ID del archivo en GridFS
    console.log("Eliminando archivo con fileId:", fileId);

    await bucket.delete(new ObjectId(fileId));  // Usa ObjectId de 'mongodb' aquí
    console.log("Archivo eliminado de GridFS.");

    // Eliminar el examen de la colección de exámenes en MongoDB
    await collection.deleteOne({ _id: new ObjectId(id) });  // Usa ObjectId de 'mongodb' aquí
    console.log("Examen eliminado de la colección 'examenes'.");

    res.status(200).json({ message: 'Examen y archivo eliminados correctamente' });
  } catch (err) {
    console.error("Error al eliminar el examen:", err);
    res.status(500).json({ message: 'Error al eliminar el examen y archivo', error: err });
  }
});

// Modificar un examen (MongoDB GridFS)
app.put('/updateExamen/:id', async (req, res) => {
  const examenId = req.params.id;  // El ID del examen a modificar
  const { id_materia, fecha } = req.body;  // Nuevos datos para el examen

  // Verificar si se sube un nuevo archivo
  const newFile = req.files && req.files.image;

  try {
    // Buscar el examen en la colección 'examenes' para obtener el fileId actual
    const collection = db.collection('examenes');
    const examen = await collection.findOne({ _id: new ObjectId(examenId) });

    if (!examen) {
      console.error("Examen no encontrado para el ID:", examenId);
      return res.status(404).json({ message: 'Examen no encontrado' });
    }

    // Actualizar los datos del examen (id_materia y fecha)
    const updatedExamen = {
      id_materia: id_materia || examen.id_materia,  // Si no se proporciona un nuevo valor, mantener el actual
      fecha: fecha || examen.fecha,  // Si no se proporciona una nueva fecha, mantener la actual
    };

    // Si se sube un nuevo archivo, reemplazamos el archivo en GridFS
    if (newFile) {
      // Eliminar el archivo anterior de GridFS
      await bucket.delete(new ObjectId(examen.examen));  // Eliminar el archivo actual en GridFS

      // Subir el nuevo archivo
      const uploadStream = bucket.openUploadStream(newFile.name);
      uploadStream.end(newFile.data);

      // Esperamos a que el archivo se haya subido
      await new Promise((resolve, reject) => {
        uploadStream.on('finish', resolve);
        uploadStream.on('error', reject);
      });

      // Obtener el nuevo fileId
      updatedExamen.examen = uploadStream.id;
      console.log('Nuevo archivo subido con éxito:', updatedExamen.examen);
    } else {
      // Si no se sube un archivo nuevo, mantenemos el fileId anterior
      updatedExamen.examen = examen.examen;
    }

    // Actualizar el examen en la colección 'examenes'
    await collection.updateOne({ _id: new ObjectId(examenId) }, { $set: updatedExamen });
    console.log("Examen actualizado:", updatedExamen);

    res.status(200).json({ message: 'Examen actualizado correctamente', data: updatedExamen });
  } catch (err) {
    console.error("Error al modificar el examen:", err);
    res.status(500).json({ message: 'Error al modificar el examen', error: err });
  }
});



// // Eliminar un examen de MongoDB y GridFS
// app.delete('/deleteExamen/:id', async (req, res) => {
//   const { id } = req.params;  // 'id' es el ID del examen en la colección de MongoDB

//   try {
//     // Buscar el examen en la colección 'examenes' para obtener el ID del archivo en GridFS
//     const collection = db.collection('examenes');
//     const examen = await collection.findOne({ _id: new MongoClient.ObjectID(id) });

//     if (!examen) {
//       return res.status(404).json({ message: 'Examen no encontrado' });
//     }

//     // Eliminar el archivo del GridFS usando el fileId
//     const fileId = examen.examen;  // El campo 'examen' tiene el ID del archivo en GridFS
//     await bucket.delete(new MongoClient.ObjectID(fileId));

//     // Eliminar el examen de la colección de exámenes en MongoDB
//     await collection.deleteOne({ _id: new MongoClient.ObjectID(id) });

//     res.status(200).json({ message: 'Examen eliminado correctamente' });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: 'Error al eliminar el examen', error: err });
//   }
// });

app.use(express.static(path.join(__dirname, 'public')));

// Iniciar el servidor
app.listen(3000, () => {
  console.log('Servidor corriendo en http://localhost:3000');
});
