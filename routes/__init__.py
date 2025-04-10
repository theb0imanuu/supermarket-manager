from flask import render_template, redirect, url_for
from app import app

@app.route('/')
def index():
    """Main entry point of the application"""
    return render_template('index.html')

@app.route('/receipt/<transaction_id>')
def receipt(transaction_id):
    """Display a receipt for a specific transaction"""
    return render_template('receipt.html', transaction_id=transaction_id)

# Import all route modules
import routes.inventory  # noqa: F401
import routes.checkout  # noqa: F401
import routes.reports  # noqa: F401
