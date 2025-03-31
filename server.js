const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");

const app = express();
const PORT = 5000;

// Middleware
app.use(express.json());
app.use(cors());

// Connect to MongoDB
mongoose.connect("mongodb://localhost:27017/farmerDB", {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log("MongoDB Connected"))
  .catch(err => console.error("MongoDB Connection Error:", err));

// =================== Farmer Schema & Model ===================
const farmerSchema = new mongoose.Schema({
    name: String,
    phone: { type: String, unique: true },
    city: String
});

const Farmer = mongoose.model("Farmer", farmerSchema);

// =================== Customer Schema ===================
const customerSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
    mobile: String,
    city: String
});

const Customer = mongoose.model("Customer", customerSchema);
app.get("/customer/:mobile", async (req, res) => {
    const { mobile } = req.params;
    try {
        const customer = await Customer.findOne({ mobile: mobile.trim() });
        if (!customer) {
            return res.status(404).json({ message: "Customer not found" });
        }
        res.json(customer);
    } catch (err) {
        res.status(500).json({ message: "Server Error", error: err.message });
    }
});

// =================== Item Schema & Model ===================
const itemSchema = new mongoose.Schema({
    name: String,
    price: Number,
    quantity: Number,
    farmerMobile: String
});

// =================== Purchase Schema ===================
const purchaseSchema = new mongoose.Schema({
    customerName: String,
    customerMobile: String,
    customerCity: String,
    itemName: String,
    price: Number,
    quantity: Number,
    purchaseDate: { type: Date, default: Date.now }
});

const Item = mongoose.model("Item", itemSchema);
const Purchase = mongoose.model("Purchase", purchaseSchema);

// =================== Farmer Routes ===================

// Register Farmer
app.post("/register", async (req, res) => {
    try {
        const { name, phone, city } = req.body;

        // Check if farmer already exists
        const existingFarmer = await Farmer.findOne({ phone });
        if (existingFarmer) {
            return res.status(400).json({ message: "Phone number already registered!" });
        }

        // Save new farmer
        const newFarmer = new Farmer({ name, phone, city });
        await newFarmer.save();
        
        res.json({ message: "Registration Successful!" });
    } catch (err) {
        res.status(500).json({ message: "Server Error", error: err.message });
    }
});

// Login Farmer
app.post("/login", async (req, res) => {
    const { phone } = req.body;

    try {
        const farmer = await Farmer.findOne({ phone });
        if (!farmer) {
            return res.status(404).json({ message: "Farmer not found." });
        }

        res.status(200).json({
            message: "Login successful.",
            farmer: {
                name: farmer.name,
                mobile: farmer.phone,
                city: farmer.city
            }
        });
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ message: "Server error." });
    }
});

// =================== Customer Routes ===================

// Register Customer
app.post("/customers/register", async (req, res) => {
    try {
        const { name, email, password, mobile, city } = req.body;

        // Check if customer already exists
        const existingCustomer = await Customer.findOne({ email });
        if (existingCustomer) {
            return res.status(400).json({ message: "Email already registered!" });
        }

        // Hash password before storing
        const hashedPassword = await bcrypt.hash(password, 10);

        // Save new customer
        const newCustomer = new Customer({ name, email, password: hashedPassword, mobile, city });
        await newCustomer.save();

        res.json({ message: "Registration Successful!" });
    } catch (err) {
        res.status(500).json({ message: "Server Error", error: err.message });
    }
});

app.post("/customers/login", async (req, res) => {
    const { email, password } = req.body;

    try {
        const customer = await Customer.findOne({ email });
        if (!customer) {
            return res.status(404).json({ message: "Customer not found." });
        }

        const isMatch = await bcrypt.compare(password, customer.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials." });
        }

        res.status(200).json({
            message: "Login successful.",
            customer: {
                name: customer.name,
                mobile: customer.mobile,
                city: customer.city
            }
        });
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ message: "Server error." });
    }
});

// =================== Customer Routes ===================

// Get all available products for customers
app.get("/customer/items", async (req, res) => {
    try {
        const items = await Item.find();
        res.json(items);
    } catch (err) {
        res.status(500).json({ message: "Error fetching items" });
    }
});
app.get("/customer/:mobile", async (req, res) => {
    const { mobile } = req.params;
    try {
        const customer = await Customer.findOne({ mobile: mobile.trim() });
        if (!customer) {
            return res.status(404).json({ message: "Customer not found" });
        }
        res.json(customer);
    } catch (err) {
        res.status(500).json({ message: "Server Error", error: err.message });
    }
});

// Handle purchase request
app.post("/customer/buy", async (req, res) => {
    const { itemId, name, price, quantity, customerName, customerMobile, customerCity } = req.body;

    try {
        // Validate input
        if (!itemId || !name || !price || !quantity || !customerName || !customerMobile || !customerCity) {
            return res.status(400).json({ message: "Invalid purchase data." });
        }

        // Deduct the purchased quantity from the item's stock
        const item = await Item.findById(itemId);
        if (!item || item.quantity < quantity) {
            return res.status(400).json({ message: "Insufficient stock or item not found." });
        }
        item.quantity -= quantity;
        await item.save();

        // Save the purchase details in the database
        const purchase = new Purchase({
            customerName,
            customerMobile,
            customerCity,
            itemName: name,
            price,
            quantity,
            purchaseDate: new Date()
        });
        await purchase.save();

        res.status(200).json({ message: "Purchase successful." });
    } catch (error) {
        console.error("Error processing purchase:", error);
        res.status(500).json({ message: "Internal server error." });
    }
});

// =================== Inventory Management Routes ===================

// Get items by farmer mobile
app.get("/items", async (req, res) => {
    try {
        const items = await Item.find(); // Fetch all items from the database
        res.status(200).json(items);
    } catch (error) {
        console.error("Error fetching items:", error);
        res.status(500).json({ message: "Failed to fetch items." });
    }
});

// Add new item with farmer mobile
app.post("/items", async (req, res) => {
    const { name, price, quantity, farmerMobile, farmerName, farmerCity } = req.body;

    try {
        const newItem = new Item({
            name,
            price,
            quantity,
            farmerMobile,
            farmerName,
            farmerCity
        });
        await newItem.save();
        res.status(201).json({ message: "Item added successfully." });
    } catch (error) {
        console.error("Error adding item:", error);
        res.status(500).json({ message: "Failed to add item." });
    }
});

// Delete item
app.delete("/items/:id", async (req, res) => {
    const { id } = req.params;

    try {
        const deletedItem = await Item.findByIdAndDelete(id);
        if (!deletedItem) return res.status(404).json({ message: "Item not found." });
        res.status(200).json({ message: "Item deleted successfully." });
    } catch (error) {
        console.error("Error deleting item:", error);
        res.status(500).json({ message: "Failed to delete item." });
    }
});

// Update item
app.put("/items/:id", async (req, res) => {
    const { id } = req.params;
    const { name, price, quantity, farmerMobile, farmerName, farmerCity } = req.body;

    try {
        const updatedItem = await Item.findByIdAndUpdate(
            id,
            { name, price, quantity, farmerMobile, farmerName, farmerCity },
            { new: true }
        );
        if (!updatedItem) return res.status(404).json({ message: "Item not found." });
        res.status(200).json({ message: "Item updated successfully.", item: updatedItem });
    } catch (error) {
        console.error("Error updating item:", error);
        res.status(500).json({ message: "Failed to update item." });
    }
});

// =================== Start Server ===================
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
