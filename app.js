new Vue({
    el: '#app', // Bind Vue instance to the HTML element with id "app"
    data: {
        lessons: [], // List of lessons fetched from the backend
        cart: [], // Items added to the cart
        orders: [], // List of placed orders
        currentPage: 'home', // Tracks the current page (home or cart)
        showForm: false, // Controls the visibility of the form to add a new lesson
        sortKey: 'subject', // The key used to sort the lessons
        sortOrder: 'asc', // The sorting order (ascending or descending)
        name: '', // Stores the customer's name for checkout
        phone: '', // Stores the customer's phone number for checkout
        newLesson: { // Object for holding the new lesson details
            subject: '',
            location: '',
            price: 0,
            spaces: 0,
            icon: ''
        },
        nameError: '', // Stores validation errors for the name
        phoneError: '', // Stores validation errors for the phone number
        checkoutSummary: null // Holds details of the checkout summary after placing an order
    },

    computed: {
        // Sorts the lessons dynamically based on the selected key and order
        sortedLessons() {
            return this.lessons.sort((a, b) => {
                let modifier = 1; // Default to ascending order
                if (this.sortOrder === 'desc') modifier = -1; // Reverse for descending order
        
                // Compare the two values based on the selected key
                if (a[this.sortKey] < b[this.sortKey]) return -1 * modifier; // `a` comes before `b`
                if (a[this.sortKey] > b[this.sortKey]) return 1 * modifier; // `a` comes after `b`
                return 0; // Values are equal, no change in order
            });
        },
        // Validates the checkout process
        validCheckout() {
            return (
                this.name && /^[a-zA-Z\s]+$/.test(this.name) && // Name must be valid
                this.phone && /^[0-9]+$/.test(this.phone) && // Phone must be valid
                this.cart.some(item => item.selected) // At least one cart item must be selected
            );
        },
        // Calculates the total price of selected items in the cart
        totalPrice() {
            return this.cart.filter(item => item.selected).reduce((total, item) => total + (item.price * item.quantity), 0);
        },
        // Counts the total number of items in the cart
        cartItemCount() {
            return this.cart.reduce((total, item) => total + item.quantity, 0);
        }
    },
    methods: {
        // Fetches lessons from the backend API
        async fetchLessons() {
            try {
                const response = await fetch('http://localhost:3000/lessons');
                this.lessons = await response.json(); // Update lessons data
            } catch (error) {
                console.error('Error fetching lessons:', error);
            }
        },
        // Fetches placed orders from the backend API
        async fetchOrders() {
            const response = await fetch('http://localhost:3000/order_placed');
            this.orders = await response.json(); // Update orders data
        },

        // Places an order and updates lesson spaces in the backend
        async placeOrder() {
            const order = {
                name: this.name, // Customer name
                phone: this.phone, // Customer phone
                items: this.cart, // Items in the cart
                total: this.totalPrice // Total price of the cart
            };

            const response = await fetch('http://localhost:3000/order_placed', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(order) // Send order details to the backend
            });

            if (response.ok) {
                // Prepare updates for lesson spaces
                const spaceUpdates = this.cart.map((item) => ({
                    id: item._id,
                    spaces: this.lessons.find((lesson) => lesson._id === item._id).spaces
                }));

                // Send updated spaces to the backend
                await fetch('http://localhost:3000/lessons/updateSpaces', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(spaceUpdates)
                });

                await this.fetchOrders(); // Refresh orders after placing the order
                this.checkoutSummary = { // Prepare checkout summary
                    name: this.name,
                    total: this.totalPrice,
                    items: this.cart
                };
                this.cart = []; // Clear the cart
                this.name = ''; // Reset the name
                this.phone = ''; // Reset the phone number
            }
        },
        // Toggles the visibility of the form for adding a lesson
        toggleForm() {
            this.showForm = !this.showForm;
        },
        // Toggles between home and cart page
        toggleCart() {
            if (this.cart.length === 0) {
                this.currentPage = 'home'; // Go to home if cart is empty
            } else {
                this.currentPage = this.currentPage === 'cart' ? 'home' : 'cart';
            }
        },
        // Adds a new lesson to the backend and updates the lessons list
        async addLesson() {
            if (this.newLesson.subject && this.newLesson.location && this.newLesson.price && this.newLesson.spaces) {
                try {
                    const response = await fetch('http://localhost:3000/lessons', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(this.newLesson) // Send new lesson details
                    });
                    const addedLesson = await response.json();
                    this.lessons.push(addedLesson); // Add the new lesson to the list
                    this.newLesson = { subject: '', location: '', price: 0, spaces: 0, icon: '' }; // Reset form
                    this.showForm = false; // Hide the form
                } catch (error) {
                    console.error('Error adding lesson:', error);
                }
            }
        },
        // Adds a lesson to the cart
        addToCart(lesson) {
            if (lesson.spaces > 0) {
                lesson.spaces--; // Decrease available spaces
                const item = this.cart.find(i => i._id === lesson._id);
                item ? item.quantity++ : this.cart.push({ ...lesson, quantity: 1, selected: true });
            }
        },
        // Removes an item from the cart and updates lesson spaces
        removeFromCart(item) {
            const lesson = this.lessons.find(lesson => lesson.id === item.id);
            if (lesson) lesson.spaces += item.quantity; // Restore spaces
            const itemIndex = this.cart.findIndex(cartItem => cartItem.id === item.id);
            if (itemIndex !== -1) this.cart.splice(itemIndex, 1); // Remove item
            if (this.cart.length === 0) this.currentPage = 'home'; // Go to home if cart is empty
        },
        // Increases the quantity of a cart item
        increaseQuantity(item) {
            const lesson = this.lessons.find(lesson => lesson.id === item.id);
            if (lesson && lesson.spaces > 0) {
                lesson.spaces--;
                item.quantity++;
            }
        },
        // Decreases the quantity of a cart item
        decreaseQuantity(item) {
            if (item.quantity > 1) {
                const lesson = this.lessons.find(lesson => lesson.id === item.id);
                if (lesson) lesson.spaces++;
                item.quantity--;
            }
        },
        // Validates the customer's name for checkout
        validateName() {
            this.nameError = /^[a-zA-Z\s]+$/.test(this.name) ? '' : 'Only letters are allowed';
        },
        // Validates the customer's phone number for checkout
        validatePhone() {
            this.phoneError = /^[0-9]+$/.test(this.phone) ? '' : 'Only numbers are allowed';
        },
        // Handles the checkout process
        checkout() {
            this.validateName(); // Validate name
            this.validatePhone(); // Validate phone
            if (this.validCheckout) this.placeOrder(); // Proceed if validation passes
        },
        // Redirects to the home page
        goToHomePage() {
            this.currentPage = 'home';
        }
    },
    // Lifecycle hook to fetch initial data
    mounted() {
        this.fetchLessons(); // Fetch lessons when the app is mounted
        this.fetchOrders(); // Fetch orders when the app is mounted
    }
});
