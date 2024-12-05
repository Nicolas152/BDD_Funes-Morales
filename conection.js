const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const db = new sqlite3.Database('./mydb.db'); 

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Crear la tabla con padron como clave primaria
db.run(`CREATE TABLE IF NOT EXISTS usuarios (
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

// Página principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Insertar un nuevo usuario (con padron como clave primaria)
app.post('/insert', (req, res) => {
  const { nombre, mail, padron } = req.body;

  const query = `INSERT INTO usuarios (padron, nombre, mail) VALUES (?, ?, ?)`;

  db.run(query, [padron, nombre, mail], function (err) {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Error al insertar el usuario', error: err });
    }
    res.status(201).json({ message: 'Usuario agregado', data: { padron, nombre, mail } });
  });
});

// Obtener todos los usuarios
app.get('/usuarios', (req, res) => {
  const query = `SELECT * FROM usuarios`;

  db.all(query, (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Error al obtener los usuarios', error: err });
    }
    res.status(200).json({ data: rows });
  });
});

// Actualizar un usuario por su padron
app.put('/update/:padron', (req, res) => {
  const { padron } = req.params;
  const { nombre, mail } = req.body;

  const query = `UPDATE usuarios SET nombre = ?, mail = ? WHERE padron = ?`;

  db.run(query, [nombre, mail, padron], function (err) {
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

// Eliminar un usuario por su padron
app.delete('/delete/:padron', (req, res) => {
  const { padron } = req.params;

  const query = `DELETE FROM usuarios WHERE padron = ?`;

  db.run(query, [padron], function (err) {
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

// Iniciar el servidor
app.listen(3000, () => {
  console.log('Servidor corriendo en http://localhost:3000');
});
