let allUsers = [];

// Cargar los usuarios desde la base de datos
async function loadUsers() {
  try {
    const response = await fetch('/usuarios');
    const result = await response.json();
    allUsers = result.data;
    displayUsers(allUsers);
  } catch (error) {
    console.error('Error al cargar los usuarios:', error);
  }
}

// Mostrar los usuarios en la tabla
function displayUsers(users) {
  const userTableBody = document.getElementById('userTableBody');
  userTableBody.innerHTML = '';
  users.forEach(user => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${user.nombre}</td>
      <td>${user.mail}</td>
      <td>${user.padron}</td>
      <td class="actions">
        <button onclick="updateUser('${user.padron}')">Actualizar</button>
        <button onclick="deleteUser('${user.padron}')">Eliminar</button>
      </td>
    `;
    userTableBody.appendChild(row);
  });
}

// Agregar un nuevo usuario
document.getElementById('usuarioForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(event.target);
  const data = Object.fromEntries(formData.entries());

  try {
    const response = await fetch('/insert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      Swal.fire('Éxito', 'Alumno agregado exitosamente', 'success');
      loadUsers();  // Recargar la lista de usuarios
      event.target.reset(); 
    } else {
      const result = await response.json();
      Swal.fire('Error', `Error al agregar el alumno: ${result.message}`, 'error');
    }
  } catch (error) {
    console.error('Error:', error);
    Swal.fire('Error', 'Hubo un problema al enviar los datos', 'error');
  }
});

async function updateUser(padron) {
  const user = allUsers.find(u => u.padron === padron);

  if (user) {
    const { value: formValues } = await Swal.fire({
      title: 'Actualizar Usuario',
      html: `
        <input id="swal-input1" class="swal2-input" placeholder="Nombre" value="${user.nombre}">
        <input id="swal-input2" class="swal2-input" placeholder="Correo" value="${user.mail}">
        <input id="swal-input3" class="swal2-input" placeholder="Padrón" value="${user.padron}" readonly>
      `,
      focusConfirm: false,
      preConfirm: () => {
        return {
          nombre: document.getElementById('swal-input1').value,
          mail: document.getElementById('swal-input2').value,
          padron: document.getElementById('swal-input3').value
        };
      }
    });

    if (formValues) {
      try {
        const response = await fetch(`/update/${padron}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formValues),
        });

        if (response.ok) {
          Swal.fire('Actualizado', 'Usuario actualizado exitosamente', 'success');
          loadUsers();  // Recargar la lista de usuarios
        } else {
          const result = await response.json();
          Swal.fire('Error', `Error al actualizar el usuario: ${result.message}`, 'error');
        }
      } catch (error) {
        console.error('Error:', error);
        Swal.fire('Error', 'Hubo un problema al actualizar el usuario', 'error');
      }
    }
  }
}

async function deleteUser(padron) {
  const { isConfirmed } = await Swal.fire({
    title: '¿Estás seguro?',
    text: "No podrás revertir esta acción.",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar'
  });

  if (isConfirmed) {
    try {
      const response = await fetch(`/delete/${padron}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        Swal.fire('Eliminado', 'Usuario eliminado exitosamente', 'success');
        loadUsers();  
      } else {
        const result = await response.json();
        Swal.fire('Error', `Error al eliminar el usuario: ${result.message}`, 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      Swal.fire('Error', 'Hubo un problema al eliminar el usuario', 'error');
    }
  }
}

function filterUsers() {
  const searchPadron = document.getElementById('searchPadron').value.toLowerCase();
  const filteredUsers = allUsers.filter(user => user.padron.toLowerCase().includes(searchPadron));
  displayUsers(filteredUsers);
}

loadUsers();
