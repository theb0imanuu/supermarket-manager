from app import db
from datetime import datetime
import random
from decimal import Decimal


class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    barcode = db.Column(db.String(20), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    price = db.Column(db.Float, nullable=False)
    cost_price = db.Column(db.Float, nullable=False)
    category = db.Column(db.String(50), nullable=False)
    stock_quantity = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'barcode': self.barcode,
            'name': self.name,
            'description': self.description,
            'price': self.price,
            'category': self.category,
            'stock_quantity': self.stock_quantity
        }


class Transaction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    reference_number = db.Column(db.String(20), unique=True, nullable=False)
    transaction_date = db.Column(db.DateTime, default=datetime.utcnow)
    total_amount = db.Column(db.Float, nullable=False)
    payment_method = db.Column(db.String(20), nullable=False)
    payment_reference = db.Column(db.String(50), nullable=True)
    cashier_name = db.Column(db.String(100), nullable=False, default="System")
    
    # Relationships
    items = db.relationship('TransactionItem', backref='transaction', lazy=True, cascade="all, delete-orphan")
    
    def to_dict(self):
        return {
            'id': self.id,
            'reference_number': self.reference_number,
            'transaction_date': self.transaction_date.isoformat(),
            'total_amount': self.total_amount,
            'payment_method': self.payment_method,
            'payment_reference': self.payment_reference,
            'cashier_name': self.cashier_name,
            'items': [item.to_dict() for item in self.items]
        }


class TransactionItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    transaction_id = db.Column(db.Integer, db.ForeignKey('transaction.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    unit_price = db.Column(db.Float, nullable=False)
    total_price = db.Column(db.Float, nullable=False)
    
    # Relationship
    product = db.relationship('Product', backref='transaction_items')
    
    def to_dict(self):
        return {
            'id': self.id,
            'product_id': self.product_id,
            'product_name': self.product.name if self.product else "Unknown",
            'quantity': self.quantity,
            'unit_price': self.unit_price,
            'total_price': self.total_price
        }


class StockMovement(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id'), nullable=False)
    movement_date = db.Column(db.DateTime, default=datetime.utcnow)
    quantity = db.Column(db.Integer, nullable=False)
    movement_type = db.Column(db.String(20), nullable=False)  # 'in', 'out', 'adjustment'
    reference = db.Column(db.String(50), nullable=True)  # Could be a transaction reference or other document
    notes = db.Column(db.Text, nullable=True)
    
    # Relationship
    product = db.relationship('Product', backref='stock_movements')
    
    def to_dict(self):
        return {
            'id': self.id,
            'product_id': self.product_id,
            'product_name': self.product.name if self.product else "Unknown",
            'movement_date': self.movement_date.isoformat(),
            'quantity': self.quantity,
            'movement_type': self.movement_type,
            'reference': self.reference,
            'notes': self.notes
        }


def populate_sample_data():
    """Function to populate sample data for development purposes"""
    # Only add sample data if the tables are empty
    if Product.query.first() is None:
        # Create some product categories
        categories = ['Groceries', 'Dairy', 'Beverages', 'Bakery', 'Household', 'Snacks', 'Produce', 'Meat']
        
        # Create sample products
        products = [
            # Groceries
            {'barcode': '123456789012', 'name': 'Rice', 'description': '1kg premium white rice', 'price': 2.99, 'cost_price': 2.00, 'category': 'Groceries', 'stock_quantity': 50},
            {'barcode': '223456789012', 'name': 'Flour', 'description': '2kg all-purpose flour', 'price': 1.99, 'cost_price': 1.20, 'category': 'Groceries', 'stock_quantity': 40},
            {'barcode': '323456789012', 'name': 'Sugar', 'description': '1kg white sugar', 'price': 1.79, 'cost_price': 1.00, 'category': 'Groceries', 'stock_quantity': 45},
            {'barcode': '423456789012', 'name': 'Salt', 'description': '500g table salt', 'price': 0.99, 'cost_price': 0.50, 'category': 'Groceries', 'stock_quantity': 60},
            
            # Dairy
            {'barcode': '523456789012', 'name': 'Milk', 'description': '1L fresh milk', 'price': 1.29, 'cost_price': 0.80, 'category': 'Dairy', 'stock_quantity': 30},
            {'barcode': '623456789012', 'name': 'Cheese', 'description': '200g cheddar cheese', 'price': 3.49, 'cost_price': 2.50, 'category': 'Dairy', 'stock_quantity': 25},
            {'barcode': '723456789012', 'name': 'Yogurt', 'description': '500g plain yogurt', 'price': 2.29, 'cost_price': 1.50, 'category': 'Dairy', 'stock_quantity': 35},
            
            # Beverages
            {'barcode': '823456789012', 'name': 'Cola', 'description': '2L cola drink', 'price': 1.99, 'cost_price': 1.00, 'category': 'Beverages', 'stock_quantity': 40},
            {'barcode': '923456789012', 'name': 'Orange Juice', 'description': '1L fresh orange juice', 'price': 2.49, 'cost_price': 1.80, 'category': 'Beverages', 'stock_quantity': 20},
            {'barcode': '023456789012', 'name': 'Mineral Water', 'description': '500ml mineral water', 'price': 0.89, 'cost_price': 0.40, 'category': 'Beverages', 'stock_quantity': 100},
            
            # Bakery
            {'barcode': '123456789013', 'name': 'Bread', 'description': '700g white bread loaf', 'price': 1.89, 'cost_price': 1.00, 'category': 'Bakery', 'stock_quantity': 15},
            {'barcode': '223456789013', 'name': 'Croissant', 'description': 'Butter croissant', 'price': 1.19, 'cost_price': 0.70, 'category': 'Bakery', 'stock_quantity': 12},
            
            # Household
            {'barcode': '323456789013', 'name': 'Dish Soap', 'description': '500ml dish washing liquid', 'price': 2.79, 'cost_price': 1.80, 'category': 'Household', 'stock_quantity': 25},
            {'barcode': '423456789013', 'name': 'Laundry Detergent', 'description': '1kg laundry powder', 'price': 4.99, 'cost_price': 3.50, 'category': 'Household', 'stock_quantity': 15},
            
            # Snacks
            {'barcode': '523456789013', 'name': 'Potato Chips', 'description': '150g salted potato chips', 'price': 1.49, 'cost_price': 0.80, 'category': 'Snacks', 'stock_quantity': 30},
            {'barcode': '623456789013', 'name': 'Chocolate Bar', 'description': '100g milk chocolate', 'price': 1.29, 'cost_price': 0.70, 'category': 'Snacks', 'stock_quantity': 40},
            
            # Produce
            {'barcode': '723456789013', 'name': 'Apples', 'description': '1kg red apples', 'price': 2.99, 'cost_price': 2.00, 'category': 'Produce', 'stock_quantity': 20},
            {'barcode': '823456789013', 'name': 'Bananas', 'description': '1kg bananas', 'price': 1.79, 'cost_price': 1.00, 'category': 'Produce', 'stock_quantity': 25},
            {'barcode': '923456789013', 'name': 'Tomatoes', 'description': '500g tomatoes', 'price': 1.99, 'cost_price': 1.20, 'category': 'Produce', 'stock_quantity': 15},
            
            # Meat
            {'barcode': '023456789013', 'name': 'Chicken Breast', 'description': '500g chicken breast', 'price': 5.99, 'cost_price': 4.00, 'category': 'Meat', 'stock_quantity': 10},
            {'barcode': '123456789014', 'name': 'Ground Beef', 'description': '500g ground beef', 'price': 4.99, 'cost_price': 3.50, 'category': 'Meat', 'stock_quantity': 12}
        ]
        
        # Add products to database
        for product_data in products:
            product = Product(**product_data)
            db.session.add(product)
        
        # Create some sample transactions
        for i in range(1, 11):
            # Create a transaction
            transaction = Transaction(
                reference_number=f'TRX-{100+i}',
                transaction_date=datetime.utcnow(),
                total_amount=0,  # will calculate this after adding items
                payment_method=random.choice(['cash', 'card', 'mpesa']),
                payment_reference=f'REF-{1000+i}',
                cashier_name='Demo Cashier'
            )
            db.session.add(transaction)
            db.session.flush()  # to get the transaction id
            
            # Add 1-5 random items to the transaction
            transaction_total = 0
            for _ in range(random.randint(1, 5)):
                # Select a random product
                product = random.choice(products)
                product_obj = Product.query.filter_by(name=product['name']).first()
                
                # Random quantity between 1 and 3
                quantity = random.randint(1, 3)
                
                # Calculate prices
                unit_price = product_obj.price
                total_price = unit_price * quantity
                transaction_total += total_price
                
                # Create transaction item
                transaction_item = TransactionItem(
                    transaction_id=transaction.id,
                    product_id=product_obj.id,
                    quantity=quantity,
                    unit_price=unit_price,
                    total_price=total_price
                )
                db.session.add(transaction_item)
                
                # Create stock movement
                stock_movement = StockMovement(
                    product_id=product_obj.id,
                    quantity=-quantity,  # negative because it's a sale
                    movement_type='out',
                    reference=transaction.reference_number,
                    notes=f'Sale transaction {transaction.reference_number}'
                )
                db.session.add(stock_movement)
                
                # Update product stock
                product_obj.stock_quantity -= quantity
            
            # Update transaction total
            transaction.total_amount = transaction_total
        
        # Commit all changes
        db.session.commit()
