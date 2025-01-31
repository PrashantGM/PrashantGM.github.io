const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const stripe = require('stripe')(process.env.STRIPE_KEY);
const asyncWrapper = require('../utils/async-wrapper');
const { BadRequestError, UnauthorizedError } = require('../errors/index');

const addItemToCart = asyncWrapper(async (req, res) => {
  const { userId } = req.params;
  const { quantity, totalAmount, bookId } = req.body;
  const nUserId = Number(userId);
  const nAmount = Number(totalAmount);
  const nQuantity = Number(quantity);
  const nBookId = Number(bookId);

  const existingCart = await prisma.cartItem.findMany({
    where: {
      user_id: nUserId,
      book_id: nBookId,
      order_id: null,
    },
  });

  if (existingCart[0]) {
    const newQuantity = existingCart[0].quantity + nQuantity;
    const newAmount = existingCart[0].total_amount + nAmount;
    await prisma.cartItem.updateMany({
      where: {
        user_id: nUserId,
        book_id: nBookId,
        order_id: null,
      },
      data: {
        quantity: newQuantity,
        total_amount: newAmount,
      },
    });
  } else {
    const response = await prisma.cartItem.create({
      data: {
        user_id: nUserId,
        book_id: nBookId,
        quantity: nQuantity,
        total_amount: nAmount,
      },
    });
  }
  res.status(201).json({ msg: 'Successfully Added to Cart' });
});

const updateCartItem = asyncWrapper(async (req, res) => {
  const { userId } = req.params;
  const { quantity, amount, bookID } = req.body;
  const nUserId = Number(userId);
  const nBookId = Number(bookID);
  const result = await prisma.cartItem.updateMany({
    where: {
      user_id: nUserId,
      book_id: nBookId,
      order_id: null,
    },
    data: {
      quantity: quantity,
      total_amount: amount,
    },
  });

  res.status(201).json({ success: true, msg: 'Successfully updated' });
});

const deleteCartItem = asyncWrapper(async (req, res) => {
  const { userId } = req.params;
  const { bookID } = req.body;
  const nUserId = Number(userId);
  const nBookId = Number(bookID);

  const result = await prisma.cartItem.deleteMany({
    where: {
      user_id: nUserId,
      book_id: nBookId,
    },
  });
  res.status(201).json({ success: true, msg: 'Successfully deleted' });
});

const viewCartItems = asyncWrapper(async (req, res) => {
  const { userId } = req.params;
  const nUserId = Number(userId);
  console.log(userId);
  const cartItems = await prisma.user.findMany({
    where: {
      id: nUserId,
    },
    include: {
      cart: {
        where: {
          order_id: null,
        },
        include: {
          books: true,
        },
      },
    },
  });
  const books = cartItems[0].cart;
  const parsedBooks = books.map((b) => {
    if (!b.books.image.startsWith('https')) {
      b.books.image = 'http://localhost:8000/uploads/' + b.books.image;
    }
    return { ...b };
  });

  res.render('./pages/cart', { data: parsedBooks });
});

const getCartItemsCount = asyncWrapper(async (req, res) => {
  const { uid: userId } = req.params;
  const nUserId = Number(userId);

  const cartItemsCount = await prisma.cartItem.findMany({
    where: {
      user_id: nUserId,
      order_id: null,
    },
  });
  res.status(200).json({ cartItemsCount, nbHits: cartItemsCount.length });
});

const createPaymentIntent = asyncWrapper(async (req, res) => {
  const { userId } = req.body;
  const nUserId = Number(userId);

  const cartItems = await prisma.cartItem.findMany({
    where: {
      user_id: nUserId,
      order_id: null,
    },
    include: {
      books: true,
    },
  });
  const users = await prisma.user.findUnique({
    where: {
      id: nUserId,
    },
  });

  let customerId;
  const checkCustomer = await stripe.customers.list({
    email: users.email,
  });
  if (checkCustomer.data.length > 0) {
    customerId = checkCustomer.data[0].id;
  } else {
    const customer = await stripe.customers.create({
      name: users.username,
      email: users.email,
    });
    customerId = customer.id;
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    customer: customerId,
    shipping_address_collection: {
      allowed_countries: ['AU', 'US', 'CA'],
    },
    shipping_options: [
      {
        shipping_rate_data: {
          type: 'fixed_amount',
          fixed_amount: { amount: 0, currency: 'usd' },
          display_name: 'Free shipping',
          delivery_estimate: {
            minimum: { unit: 'business_day', value: 5 },
            maximum: { unit: 'business_day', value: 7 },
          },
        },
      },
    ],
    line_items: cartItems.map((item) => {
      return {
        price_data: {
          currency: 'usd',
          product_data: {
            name: item.books.title,
          },
          unit_amount: item.books.price * 100,
        },
        quantity: item.quantity,
      };
    }),
    success_url: `http://localhost:8000/orders/checkout/success`,
    cancel_url: `http://localhost:8000/order/${nUserId}`,
  });

  res.status(200).json({ success: true, data: { url: session.url } });
});
const testRoute = async (req, res) => {
  //for testing
  res.json('Something');
};

const webhookListener = asyncWrapper(async (req, res) => {
  console.log('should at least trigger');
  let event = req.body;
  let endpointSecret = process.env.WEBHOOK_TEST_KEY;

  if (endpointSecret) {
    const signature = req.headers['stripe-signature'];
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        endpointSecret
      );
    } catch (err) {
      console.log(`⚠️  Webhook signature verification failed.`, err.message);
      return res.sendStatus(400);
    }
  }
  switch (event.type) {
    case 'checkout.session.completed':
      console.log(event.data.object);
      const { payment_intent, customer_details, shipping_cost, amount_total } =
        event.data.object;
      const { email, address } = customer_details;
      const deliveryCharge = shipping_cost.amount_total;
      const deliveryAddress = Object.values(address).join(',');

      const users = await prisma.user.findUnique({
        where: {
          email,
        },
        include: {
          cart: {
            include: {
              order: true,
            },
            orderBy: {
              updated_at: 'desc',
            },
          },
        },
      });

      const order = await prisma.order.create({
        data: {
          delivery_charge: deliveryCharge,
          total: amount_total / 100,
          delivery_address: deliveryAddress,
          status: 'PAID',
          payment_intent_id: payment_intent,
        },
      });

      const updatedCart = await prisma.cartItem.updateMany({
        where: {
          AND: [
            {
              user_id: users.id,
            },
            {
              order_id: null,
            },
          ],
        },
        data: {
          order_id: order.id,
        },
      });
      if (updatedCart.count == 0) {
        throw new BadRequestError('Something went wrong! Please try again');
      }
      if (order.length > 0) {
        console.log('Placed complete order successfuly to database');
      }
      break;
    case 'customer.created':
      console.log('customer created');
      break;
    case 'charge.succeeded' ||
      'payment_intent.created' ||
      'payment_intent.succeeded':
      console.log(`${event.type} success!`);
      break;
    default:
      console.log(`Unhandled event type ${event.type}.`);
  }
  res.send();
});

const getOrders = asyncWrapper(async (req, res) => {
  const { userId } = req.params;
  const nUserId = Number(userId);

  const orderItems = await prisma.order.findMany({
    where: {
      cart_items: {
        some: {
          user_id: nUserId,
        },
      },
    },
    include: {
      cart_items: {
        include: {
          books: true,
        },
      },
    },
  });

  const parsedOrderItems = orderItems.map((order) => {
    const date = new Date(order.created_at);
    let month = date.getUTCMonth() + 1;
    let day = date.getUTCDate();
    let year = date.getUTCFullYear();
    const newCreatedAt = year + '/' + month + '/' + day;
    if (order.delivery_charge == 0) {
      order.delivery_charge = 'FREE';
    }
    return { ...order, order_date: newCreatedAt };
  });

  const ongoingOrders = parsedOrderItems.filter((o) => {
    return o.status === 'PAID';
  });

  const pastOrders = parsedOrderItems.filter((o) => {
    return o.status === 'DELIVERED';
  });
  res.render('./pages/order', {
    dataCurrent: ongoingOrders,
    data: pastOrders,
  });
});

const getAllOrders = asyncWrapper(async (req, res) => {
  const orderItems = await prisma.order.findMany({
    include: {
      cart_items: {
        include: {
          books: true,
          users: true,
        },
      },
    },
    orderBy: {
      updated_at: 'desc',
    },
  });
  orderItems.forEach((order) => {
    const dateOrdered = new Date(order.created_at);
    let monthOrdered = dateOrdered.getUTCMonth() + 1;
    let dayOrdered = dateOrdered.getUTCDate();
    let yearOrdered = dateOrdered.getUTCFullYear();
    order.created_at = yearOrdered + '/' + monthOrdered + '/' + dayOrdered;

    const dateDelivered = new Date(order.updated_at);
    let monthDelivered = dateDelivered.getUTCMonth() + 1;
    let dayDelivered = dateDelivered.getUTCDate();
    let yearDelivered = dateDelivered.getUTCFullYear();
    order.updated_at =
      yearDelivered + '/' + monthDelivered + '/' + dayDelivered;
    if (order.updated_at === order.created_at) {
      order.updated_at = 'In Delivery';
    }

    order.cart_items.forEach((cart, index) => {
      if (index > 0) {
        delete cart.users;
      }
    });
  });
  console.log(orderItems[0]);
  res.status(200).render('./admin/orders', { data: orderItems });
});

const updateOrder = asyncWrapper(async (req, res) => {
  const id = Number(req.params.id);

  const { deliveryAddress, deliveryDate, status } = req.body;
  const parsedDate = new Date(deliveryDate);

  const order = await prisma.order.update({
    where: {
      id,
    },
    data: {
      delivery_address: deliveryAddress,
      updated_at: parsedDate,
      status,
    },
  });
  res.status(200).json({
    success: true,
    msg: `Successfully updated order with id:${order.id}`,
  });
});

const deleteOrder = asyncWrapper(async (req, res) => {
  const id = Number(req.params.id);

  await prisma.order.delete({
    where: {
      id,
    },
  });
  res.status(201).json({ success: true, msg: 'Successfully deleted' });
});
module.exports = {
  addItemToCart,
  updateCartItem,
  viewCartItems,
  deleteCartItem,
  getCartItemsCount,
  createPaymentIntent,
  webhookListener,
  getOrders,
  getAllOrders,
  updateOrder,
  deleteOrder,
  testRoute,
};
