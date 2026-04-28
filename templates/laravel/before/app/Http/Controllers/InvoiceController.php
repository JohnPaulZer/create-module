<?php

namespace App\Http\Controllers;

use App\Services\InvoiceService;

class InvoiceController extends Controller
{
    public function index(): array
    {
        return (new InvoiceService())->all();
    }
}
