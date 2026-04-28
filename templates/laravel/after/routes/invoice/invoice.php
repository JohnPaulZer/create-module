<?php

use App\Http\Controllers\Invoice\InvoiceController;
use Illuminate\Support\Facades\Route;

Route::get('/invoices', [InvoiceController::class, 'index']);
