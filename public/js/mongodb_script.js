// Función para agregar un examen (Subir archivo y agregar a MongoDB)
document.getElementById('examenForm').addEventListener('submit', async (e) => {
    e.preventDefault();
  
    const idMateria = document.getElementById('id_materia').value;
    const examenFile = document.getElementById('examenFile').files[0];
    const fecha = document.getElementById('fecha').value;
  
    if (!examenFile) {
      Swal.fire('Error', 'Por favor, selecciona un archivo de examen', 'error');
      return;
    }
  
    const formData = new FormData();
    formData.append('id_materia', idMateria);
    formData.append('fecha', fecha);
    formData.append('image', examenFile);
  
    try {
      const response = await fetch('/uploadExamenImage', {
        method: 'POST',
        body: formData,
      });
  
      const data = await response.json();
      if (response.ok) {
        Swal.fire('Éxito', 'Examen agregado correctamente', 'success');
        loadExamenes(); // Recargar la lista de exámenes
      } else {
        Swal.fire('Error', data.message, 'error');
      }
    } catch (error) {
      console.error('Error al agregar examen:', error);
      Swal.fire('Error', 'Ocurrió un error al agregar el examen', 'error');
    }
  });
  
// Función para obtener todos los exámenes y cargarlos en la tabla
async function loadExamenes() {
  try {
    const response = await fetch('/examenes');
    const data = await response.json();

    if (response.ok) {
      const examenTableBody = document.getElementById('examenTableBody');
      examenTableBody.innerHTML = ''; // Limpiar tabla

      data.data.forEach(examen => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${examen.id_materia}</td>
          <td>${examen.fecha}</td>
          <td>
            <a href="/examenImage/${examen.examen}" target="_blank">Descargar Archivo</a>
            <button onclick="updateExamen('${examen._id}')">Actualizar</button>
            <button onclick="deleteExamen('${examen._id}')">Eliminar</button>
          </td>
        `;
        examenTableBody.appendChild(row);
      });
    } else {
      Swal.fire('Error', 'No se pudieron obtener los exámenes', 'error');
    }
  } catch (error) {
    console.error('Error al cargar los exámenes:', error);
    Swal.fire('Error', 'Ocurrió un error al cargar los exámenes', 'error');
  }
}


// Función para actualizar un examen
async function updateExamen(examenId) {
  // Obtener los datos actuales del examen
  const examen = await fetch(`/examenes/${examenId}`).then(res => res.json());

  if (examen.data) {
    const { id_materia, fecha, examen: fileId } = examen.data;

    // Mostrar el modal de SweetAlert con los datos actuales del examen
    const { value: formValues } = await Swal.fire({
      title: 'Modificar Examen',
      html: `
        <input id="swal-input1" class="swal2-input" placeholder="ID Materia" value="${id_materia}">
        <input id="swal-input2" class="swal2-input" placeholder="Fecha" value="${fecha}">
        <input id="swal-input3" type="file" class="swal2-input" placeholder="Nuevo archivo">
      `,
      focusConfirm: false,
      preConfirm: () => {
        return {
          id_materia: document.getElementById('swal-input1').value,
          fecha: document.getElementById('swal-input2').value,
          file: document.getElementById('swal-input3').files[0] // Capturamos el archivo si lo hay
        };
      }
    });

    // Si el formulario tiene datos, enviamos los nuevos datos
    if (formValues) {
      const formData = new FormData();
      formData.append('id_materia', formValues.id_materia);
      formData.append('fecha', formValues.fecha);
      if (formValues.file) {
        formData.append('image', formValues.file); // Si hay un nuevo archivo, lo agregamos al formulario
      }

      try {
        // Enviamos la solicitud PUT al servidor para actualizar el examen
        const response = await fetch(`/updateExamen/${examenId}`, {
          method: 'PUT',
          body: formData,
        });

        if (response.ok) {
          Swal.fire('Actualizado', 'Examen actualizado exitosamente', 'success');
          loadExamenes(); // Recargar la lista de exámenes
        } else {
          const result = await response.json();
          Swal.fire('Error', `Error al actualizar el examen: ${result.message}`, 'error');
        }
      } catch (error) {
        console.error('Error:', error);
        Swal.fire('Error', 'Hubo un problema al actualizar el examen', 'error');
      }
    }
  }
}

  
  // Función para eliminar un examen
  async function deleteExamen(id) {
    const confirmDelete = await Swal.fire({
      title: '¿Estás seguro?',
      text: '¡Este examen será eliminado permanentemente!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    });
  
    if (confirmDelete.isConfirmed) {
      try {
        const response = await fetch(`/deleteExamen/${id}`, {
          method: 'DELETE',
        });
  
        const data = await response.json();
        if (response.ok) {
          Swal.fire('Éxito', 'Examen eliminado correctamente', 'success');
          loadExamenes(); // Recargar la lista de exámenes
        } else {
          Swal.fire('Error', data.message, 'error');
        }
      } catch (error) {
        console.error('Error al eliminar examen:', error);
        Swal.fire('Error', 'Ocurrió un error al eliminar el examen', 'error');
      }
    }
  }
  
  // Cargar los exámenes al cargar la página
  loadExamenes();
  