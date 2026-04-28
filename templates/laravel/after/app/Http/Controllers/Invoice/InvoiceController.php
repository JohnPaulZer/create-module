<?php

namespace App\Http\Controllers\Invoice;

use App\Http\Controllers\Controller;
use App\Services\Invoice\InvoiceService;

class InvoiceController extends Controller
{
    public function index(): array
    {
        return (new InvoiceService())->all();
    }
}
