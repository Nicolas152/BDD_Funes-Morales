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
    formData.append('examen', examenFile);
  
    try {
      const response = await fetch('/insertExamen', {
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
  