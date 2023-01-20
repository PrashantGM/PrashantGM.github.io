import { toast } from './toast.js';

let loggedIn = false;
let parsedUserData;
let bookId = 0;
let currentBookID = Number(
  document.querySelector('.book-details').getAttribute('data-bookId')
);
console.log('current bookId', currentBookID);
async function onload() {
  await loadNav();
  await loadPage();
  await addtoCart();
}
onload();

async function loadNav() {
  const btnProfile = document.querySelector('.btn-profile');
  console.log('btnprofile', btnProfile);

  try {
    const isLoggedIn = await viewLoggedIn();
    loggedIn = isLoggedIn.success;
    if (loggedIn) {
      parsedUserData = JSON.parse(isLoggedIn.payload);

      btnProfile.textContent = parsedUserData.username;
      const userIcon = document.createElement('i');
      userIcon.className = 'fa fa-user-circle';
      btnProfile.appendChild(userIcon);

      const downIcon = document.createElement('i');
      downIcon.className = 'fa fa-caret-down';
      btnProfile.appendChild(downIcon);

      // document.querySelector('#navRead').style.display = 'none';
      const navlinkDash = document.querySelector('#nav-dashboard');
      console.log('navlinkdash', navlinkDash);
      navlinkDash.style.display = 'none';
    } else {
      btnProfile.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = 'http://localhost:8000/user/login';
      });
    }
  } catch (error) {
    console.log(error);
  }
}
async function loadPage() {
  const similarSection = document.querySelector('.others');
  let currentGenre = similarSection.getAttribute('data-genre');

  try {
    const response = await fetch(
      `http://localhost:8000/books/similar?genre=${currentGenre}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'GET',
      }
    );
    const result = await response.json();
    const books = result.data;
    books.forEach((book) => {
      bookId = book.id;
      if (currentBookID == bookId) {
        return;
      }
      const bookOthers = document.createElement('div');
      bookOthers.className = 'book-others';
      similarSection.appendChild(bookOthers);

      const title = document.createElement('p');
      title.style.fontWeight = 'bold';
      title.style.height = '40px';
      title.style.textAlign = 'center';
      title.innerHTML = book.title;
      bookOthers.appendChild(title);

      const divImage = document.createElement('div');
      divImage.id = 'div-bookImage';
      divImage.style.marginTop = '10px';
      bookOthers.appendChild(divImage);
      const image = document.createElement('img');
      image.src = book.image;
      image.width = '90';
      image.height = '90';
      divImage.appendChild(image);

      const author = document.createElement('p');
      author.className = 'm-t-5';
      author.style.overflowWrap = 'break-word';
      author.innerHTML = `By ${book.author}`;
      bookOthers.appendChild(author);

      const genre = document.createElement('p');
      genre.style.fontStyle = 'italic';
      genre.style.height = '20px';
      genre.className = 'm-t-5';
      genre.style.overflowWrap = 'break-word';

      genre.innerHTML = book.genre;
      bookOthers.appendChild(genre);

      const price = document.createElement('p');
      price.style.fontWeight = 'bold';
      price.className = 'm-t-10';
      price.innerHTML = `Rs. ${book.price}`;
      bookOthers.appendChild(price);

      bookOthers.addEventListener('click', () => {
        window.location.assign(`http://localhost:8000/books/${book.id}`);
      });
    });
  } catch (error) {
    console.log(error);
  }
}

async function addtoCart() {
  const totalPrice = document.querySelector('#price-total');
  let price = Number(totalPrice.getAttribute('data-price'));
  let totalAmount = price * 1;
  const inputQuantity = document.querySelector('input[name="quantity"]');
  let quantity = 1;
  inputQuantity.addEventListener('input', (e) => {
    e.preventDefault();
    quantity = Number(inputQuantity.value);
    totalAmount = price * quantity;
    totalPrice.innerHTML = `Rs ${totalAmount}`;
  });

  const btnAddCart = document.querySelector('#btn-addCart');
  btnAddCart.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      console.log('currentbookid', currentBookID);
      if (loggedIn) {
        const userId = parsedUserData.id;
        const response = await fetch(`http://localhost:8000/order/${userId}`, {
          headers: {
            'Content-Type': 'application/json',
          },
          method: 'POST',
          body: JSON.stringify({
            quantity,
            totalAmount,
            bookId: currentBookID,
          }),
        });
        const parsedResponse = await response.json();
        const bookSection = document.querySelector('.book-section');
        toast.initToast(bookSection);
        toast.generateToast({
          message: parsedResponse.msg,
          background: '#eaf7fb',
          color: 'green',
          length: '2000ms',
        });
      } else {
        window.location.replace('http://localhost:8000/user/login');
      }
    } catch (error) {
      console.log(error);
    }
  });
}

async function viewLoggedIn() {
  try {
    const payload = await fetch('http://localhost:8000/user/stat', {
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'GET',
    });
    const userData = await payload.json();
    return userData;
  } catch (error) {
    console.log(error);
  }
}
