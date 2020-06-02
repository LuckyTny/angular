/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {AttributeMarker} from '@angular/compiler/src/core';

import * as ast from '../../../../expression_parser/ast';
import * as tmpl from '../../../r3_ast';
import {Property} from '../features/binding';
import {InterpolationExpr} from '../features/binding/interpolation';
import {ElementEnd, ElementStart} from '../features/element';
import {Template} from '../features/embedded_views';
import {Text, TextInterpolate} from '../features/text';
import * as ir from '../ir';

import {Scope} from './scope';
import {ValuePreprocessor} from './value';

export interface IrTemplate {
  create: ir.CreateList;
  update: ir.UpdateList;
  scope: Scope;
}

export function parse(input: tmpl.Node[], name: string): ir.RootTemplate {
  const root = TemplateToIrConverter.parseRoot(input);
  root.name = name;
  return root;
}

class TemplateToIrConverter implements tmpl.Visitor<void>, ast.AstVisitor {
  private create = new ir.CreateList();
  private update = new ir.UpdateList();

  private preprocessor = new ValuePreprocessor(this.scope);

  constructor(private scope: Scope) {}

  /**
   * Parse a template beginning from its top-level, including all sub-templates.
   */
  static parseRoot(input: tmpl.Node[]): ir.RootTemplate {
    const parser = new TemplateToIrConverter(Scope.root());
    for (const node of input) {
      node.visit(parser);
    }

    const {create, update, scope} = parser.finalize();
    return new ir.RootTemplate(create, update, scope);
  }

  /**
   * Parse a child template of a higher-level template, including all sub-templates.
   */
  private parseChild(id: ir.Id, input: tmpl.Template): IrTemplate {
    const childScope = this.scope.child(id);
    const parser = new TemplateToIrConverter(childScope);

    for (const v of input.variables) {
      childScope.recordVariable(v.name, id, v.value);
    }

    for (const node of input.children) {
      node.visit(parser);
    }

    return parser.finalize();
  }

  visitElement(element: tmpl.Element): void {
    // Allocate an id.
    const id = this.scope.allocateId();

    let refs: ir.Reference[]|null = null;
    if (element.references.length > 0) {
      refs = [];
      for (const ref of element.references) {
        refs.push(this.scope.recordReference(ref.name, id, ref.value));
      }
    }

    const elementStart = new ElementStart(id, element.name);
    elementStart.refs = refs;

    this.create.append(elementStart);

    if (element.attributes.length > 0 || element.inputs.length > 0) {
      elementStart.attrs = [];
      for (const attr of element.attributes) {
        elementStart.attrs.push(attr.name);
        elementStart.attrs.push(attr.value);
      }

      if (element.inputs.length > 0) {
        elementStart.attrs.push(AttributeMarker.Bindings);
      }

      for (const input of element.inputs) {
        elementStart.attrs.push(input.name);

        const property = new Property(id, input.name, this.preprocessor.process(input.value));
        this.update.append(property);
      }
    }


    tmpl.visitAll(this, element.children);

    this.create.append(new ElementEnd(id));
  }

  visitText(text: tmpl.Text): void {
    const id = this.scope.allocateId();
    this.create.append(new Text(id, text.value));
  }

  visitBoundText(text: tmpl.BoundText): void {
    const id = this.scope.allocateId();
    this.create.append(new Text(id));

    let top = text.value;
    if (top instanceof ast.ASTWithSource) {
      top = top.ast;
    }

    if (top instanceof ast.Interpolation) {
      this.update.append(new TextInterpolate(
          id,
          new InterpolationExpr(
              top.expressions.map(e => this.preprocessor.process(e)), top.strings)));
    } else {
      throw new Error('BoundText is not an interpolation expression?');
    }
  }

  visitTemplate(template: tmpl.Template): void {
    const id = this.scope.allocateId();
    const parsed = this.parseChild(id, template);

    let refs: ir.Reference[]|null = null;
    if (template.references.length > 0) {
      refs = [];
      for (const ref of template.references) {
        refs.push(this.scope.recordReference(ref.name, id, ref.value));
      }
    }

    const view = new Template(id, template.tagName !== '' ? template.tagName : 'ng-template');
    this.create.append(view);
    view.create = parsed.create;
    view.update = parsed.update;
    view.refs = refs;
  }

  visitContent(content: tmpl.Content): void {
    throw new Error('Method not implemented.');
  }
  visitVariable(variable: tmpl.Variable): void {
    throw new Error('Method not implemented.');
  }
  visitReference(reference: tmpl.Reference): void {
    throw new Error('Method not implemented.');
  }
  visitTextAttribute(attribute: tmpl.TextAttribute): void {
    throw new Error('Method not implemented.');
  }
  visitBoundAttribute(attribute: tmpl.BoundAttribute): void {
    throw new Error('Method not implemented.');
  }
  visitBoundEvent(attribute: tmpl.BoundEvent): void {
    throw new Error('Method not implemented.');
  }
  visitIcu(icu: tmpl.Icu): void {
    throw new Error('Method not implemented.');
  }

  finalize(): IrTemplate {
    return {
      create: this.create,
      update: this.update,
      scope: this.scope,
    };
  }


  visitBinary(ast: ast.Binary, context: any) {
    throw new Error('Method not implemented.');
  }
  visitChain(ast: ast.Chain, context: any) {
    throw new Error('Method not implemented.');
  }
  visitConditional(ast: ast.Conditional, context: any) {
    throw new Error('Method not implemented.');
  }
  visitFunctionCall(ast: ast.FunctionCall, context: any) {
    throw new Error('Method not implemented.');
  }
  visitImplicitReceiver(ast: ast.ImplicitReceiver, context: any) {
    throw new Error('Method not implemented.');
  }
  visitInterpolation(ast: ast.Interpolation, context: any) {
    throw new Error('Method not implemented.');
  }
  visitKeyedRead(ast: ast.KeyedRead, context: any) {
    throw new Error('Method not implemented.');
  }
  visitKeyedWrite(ast: ast.KeyedWrite, context: any) {
    throw new Error('Method not implemented.');
  }
  visitLiteralArray(ast: ast.LiteralArray, context: any) {
    throw new Error('Method not implemented.');
  }
  visitLiteralMap(ast: ast.LiteralMap, context: any) {
    throw new Error('Method not implemented.');
  }
  visitLiteralPrimitive(ast: ast.LiteralPrimitive, context: any) {
    throw new Error('Method not implemented.');
  }
  visitMethodCall(ast: ast.MethodCall, context: any) {
    throw new Error('Method not implemented.');
  }
  visitPipe(ast: ast.BindingPipe, context: any) {
    throw new Error('Method not implemented.');
  }
  visitPrefixNot(ast: ast.PrefixNot, context: any) {
    throw new Error('Method not implemented.');
  }
  visitNonNullAssert(ast: ast.NonNullAssert, context: any) {
    throw new Error('Method not implemented.');
  }
  visitPropertyRead(ast: ast.PropertyRead, context: any) {
    throw new Error('Method not implemented.');
  }
  visitPropertyWrite(ast: ast.PropertyWrite, context: any) {
    throw new Error('Method not implemented.');
  }
  visitQuote(ast: ast.Quote, context: any) {
    throw new Error('Method not implemented.');
  }
  visitSafeMethodCall(ast: ast.SafeMethodCall, context: any) {
    throw new Error('Method not implemented.');
  }
  visitSafePropertyRead(ast: ast.SafePropertyRead, context: any) {
    throw new Error('Method not implemented.');
  }
}

const FRESH_NODE = {
  next: null,
  prev: null,
};
