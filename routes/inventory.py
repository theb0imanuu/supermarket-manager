from flask import Blueprint, render_template, jsonify, request
from app import db
from models import Product, StockMovement
import logging

# Create a blueprint for inventory management
inventory_bp = Blueprint('inventory', __name__, url_prefix='/inventory')

@inventory_bp.route('/')
def inventory_page():
    """Display the inventory management page"""
    return render_template('inventory.html')

@inventory_bp.route('/products', methods=['GET'])
def get_products():
    """API endpoint to get all products"""
    try:
        products = Product.query.all()
        return jsonify({
            'success': True,
            'products': [product.to_dict() for product in products]
        })
    except Exception as e:
        logging.error(f"Error fetching products: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@inventory_bp.route('/products/<int:product_id>', methods=['GET'])
def get_product(product_id):
    """API endpoint to get a specific product"""
    try:
        product = Product.query.get_or_404(product_id)
        return jsonify({
            'success': True,
            'product': product.to_dict()
        })
    except Exception as e:
        logging.error(f"Error fetching product {product_id}: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@inventory_bp.route('/products', methods=['POST'])
def add_product():
    """API endpoint to add a new product"""
    try:
        data = request.json
        product = Product(
            barcode=data.get('barcode'),
            name=data.get('name'),
            description=data.get('description', ''),
            price=float(data.get('price')),
            cost_price=float(data.get('cost_price')),
            category=data.get('category'),
            stock_quantity=int(data.get('stock_quantity', 0))
        )
        db.session.add(product)
        db.session.commit()
        
        # Create stock movement for initial stock
        if product.stock_quantity > 0:
            stock_movement = StockMovement(
                product_id=product.id,
                quantity=product.stock_quantity,
                movement_type='in',
                reference='Initial Stock',
                notes='Initial stock upon product creation'
            )
            db.session.add(stock_movement)
            db.session.commit()
            
        return jsonify({
            'success': True,
            'product': product.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error adding product: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@inventory_bp.route('/products/<int:product_id>', methods=['PUT'])
def update_product(product_id):
    """API endpoint to update a product"""
    try:
        product = Product.query.get_or_404(product_id)
        data = request.json
        
        # Track stock changes for movement record
        old_stock = product.stock_quantity
        
        # Update product fields if present in the request
        if 'barcode' in data:
            product.barcode = data['barcode']
        if 'name' in data:
            product.name = data['name']
        if 'description' in data:
            product.description = data['description']
        if 'price' in data:
            product.price = float(data['price'])
        if 'cost_price' in data:
            product.cost_price = float(data['cost_price'])
        if 'category' in data:
            product.category = data['category']
        if 'stock_quantity' in data:
            product.stock_quantity = int(data['stock_quantity'])
        
        db.session.commit()
        
        # Create stock movement if quantity changed
        new_stock = product.stock_quantity
        if new_stock != old_stock:
            movement_type = 'in' if new_stock > old_stock else 'out'
            quantity = abs(new_stock - old_stock)
            stock_movement = StockMovement(
                product_id=product.id,
                quantity=quantity if movement_type == 'in' else -quantity,
                movement_type=movement_type,
                reference='Stock Adjustment',
                notes=f'Stock adjusted from {old_stock} to {new_stock}'
            )
            db.session.add(stock_movement)
            db.session.commit()
            
        return jsonify({
            'success': True,
            'product': product.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error updating product {product_id}: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@inventory_bp.route('/products/<int:product_id>', methods=['DELETE'])
def delete_product(product_id):
    """API endpoint to delete a product"""
    try:
        product = Product.query.get_or_404(product_id)
        db.session.delete(product)
        db.session.commit()
        return jsonify({
            'success': True,
            'message': f'Product {product_id} deleted successfully'
        })
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error deleting product {product_id}: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@inventory_bp.route('/stock-movements', methods=['GET'])
def get_stock_movements():
    """API endpoint to get stock movement history"""
    try:
        movements = StockMovement.query.order_by(StockMovement.movement_date.desc()).all()
        return jsonify({
            'success': True,
            'movements': [movement.to_dict() for movement in movements]
        })
    except Exception as e:
        logging.error(f"Error fetching stock movements: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@inventory_bp.route('/stock-movements', methods=['POST'])
def add_stock_movement():
    """API endpoint to add a stock movement"""
    try:
        data = request.json
        product = Product.query.get_or_404(data.get('product_id'))
        quantity = int(data.get('quantity', 0))
        movement_type = data.get('movement_type')
        
        # Create the stock movement
        stock_movement = StockMovement(
            product_id=product.id,
            quantity=quantity if movement_type == 'in' else -quantity,
            movement_type=movement_type,
            reference=data.get('reference', ''),
            notes=data.get('notes', '')
        )
        db.session.add(stock_movement)
        
        # Update product stock quantity
        if movement_type == 'in':
            product.stock_quantity += quantity
        elif movement_type == 'out':
            product.stock_quantity -= quantity
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'movement': stock_movement.to_dict(),
            'updated_product': product.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error adding stock movement: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@inventory_bp.route('/categories', methods=['GET'])
def get_categories():
    """API endpoint to get all product categories"""
    try:
        # Get unique categories from products
        categories = db.session.query(Product.category).distinct().all()
        category_list = [category[0] for category in categories]
        
        return jsonify({
            'success': True,
            'categories': category_list
        })
    except Exception as e:
        logging.error(f"Error fetching categories: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
